import archiver from "archiver";
import { PassThrough } from "stream";
import { IDatabaseConnection } from "../utils/database";
import { ResponseHelper } from "../utils/response";
import BaseRouteHandler from "./BaseRouteHandler";
import { BaseRequest } from "../types";
import { EventEntry, EventSettings, GuestEntry, PHOTO_STATUSES, PhotoEntry, PhotoStatus } from "../weddingcam/types";
import {
  cleanDisplayName,
  clientIp,
  decodeCursor,
  derivePhotoId,
  encodeCursor,
  EVENT_ID_RE,
  hashSecret,
  limits,
  newEventId,
  newGuestId,
  newSecret,
  PHOTO_ID_RE,
  readRawBody,
  SECRET_RE,
  secretMatches,
  UUID_RE,
  WeddingCamError,
} from "../weddingcam/helpers";
import { processImage } from "../weddingcam/images";
import { deleteObjects, getObject, objectPaths, putJpeg, readUrl, uploadStream } from "../weddingcam/storage";

type Values = (string | boolean | number | null)[];

/**
 * WeddingCam: a shared "disposable camera" for events.
 *
 * Guest routes (/weddingcam/guest/...) skip validateUser. Guests join by exchanging the secret
 * from the event's QR code for a random bearer token. Host routes (/weddingcam/events/...) need
 * a user of the WeddingCam application, like every other app's routes.
 */
class WeddingCamHandler extends BaseRouteHandler {
  private database: IDatabaseConnection;
  private responseHelper: ResponseHelper;
  // Set once a rate-limit hit is recorded, so a request that then fails still counts.
  private hasSavepoint: boolean;
  constructor(database: IDatabaseConnection, responseHelper: ResponseHelper) {
    super(responseHelper.req, responseHelper.next);
    this.database = database;
    this.responseHelper = responseHelper;
    this.hasSavepoint = false;
  }

  // Guest routes.
  public async CreateSession(): Promise<void> {
    this.RunGuest(this.CreateSessionInternal);
  }

  public async GetMe(): Promise<void> {
    this.RunGuest(this.GetMeInternal);
  }

  public async UpdateMe(): Promise<void> {
    this.RunGuest(this.UpdateMeInternal);
  }

  public async UploadPhoto(): Promise<void> {
    this.RunGuest(this.UploadPhotoInternal);
  }

  public async ListPhotos(): Promise<void> {
    this.RunGuest(this.ListPhotosInternal);
  }

  // Host routes.
  public async ListEvents(): Promise<void> {
    this.RunHost(this.ListEventsInternal);
  }

  public async CreateEvent(): Promise<void> {
    this.RunHost(this.CreateEventInternal);
  }

  public async GetEvent(): Promise<void> {
    this.RunHost(this.GetEventInternal);
  }

  public async UpdateEvent(): Promise<void> {
    this.RunHost(this.UpdateEventInternal);
  }

  public async RotateKey(): Promise<void> {
    this.RunHost(this.RotateKeyInternal);
  }

  public async ListEventPhotos(): Promise<void> {
    this.RunHost(this.ListEventPhotosInternal);
  }

  public async UpdatePhoto(): Promise<void> {
    this.RunHost(this.UpdatePhotoInternal);
  }

  public async DeletePhoto(): Promise<void> {
    this.RunHost(this.DeletePhotoInternal);
  }

  public async ExportPhotos(): Promise<void> {
    this.RunHost(this.ExportPhotosInternal);
  }

  /**
   * Exchanges the secret from the QR code for a guest token. The app reads the secret from the
   * URL fragment, which never appears in server logs, then removes it from the address bar.
   */
  private CreateSessionInternal = async (): Promise<void> => {
    const req = this.responseHelper.req;
    await this.RateLimit("session-ip", clientIp(req), limits.sessionPerIp);

    const body = req.body as { eventId?: unknown; key?: unknown };
    const invalid = new WeddingCamError(401, "invalid_link", "This link isn't valid. Scan the QR code again");
    if (typeof body.eventId !== "string" || !EVENT_ID_RE.test(body.eventId)) throw invalid;
    if (typeof body.key !== "string" || !SECRET_RE.test(body.key)) throw invalid;

    const event = await this.FindEvent(body.eventId);
    // A missing event and a wrong key get the same response, so event ids can't be probed.
    if (!event || !secretMatches(body.key, event.key_hash)) throw invalid;

    // Re-scanning keeps the same guest (and shot count) while their session is still valid.
    let token = this.BearerToken();
    let guests: GuestEntry[] = [];
    if (token) {
      guests = await this.Query(
        `UPDATE weddingcam_guests SET session_expires_at=now() + make_interval(days => $4) WHERE token_hash=$1 AND eventid=$2 AND secret_version=$3 AND session_expires_at > now() RETURNING ${GUEST_COLUMNS};`,
        [hashSecret(token), event.eventid, event.secret_version, limits.sessionTtlDays]
      );
    }
    if (guests.length === 0) {
      token = newSecret();
      guests = await this.Query(
        `INSERT INTO weddingcam_guests (guestid, eventid, token_hash, secret_version, session_expires_at) VALUES ($1, $2, $3, $4, now() + make_interval(days => $5)) RETURNING ${GUEST_COLUMNS};`,
        [newGuestId(), event.eventid, hashSecret(token!), event.secret_version, limits.sessionTtlDays]
      );
    }

    this.Send(200, { token, event: publicEvent(event), guest: guestInfo(guests[0], event) });
  };

  private GetMeInternal = async (): Promise<void> => {
    const { guest, event } = await this.RequireGuest();
    this.Send(200, { event: publicEvent(event), guest: guestInfo(guest, event) });
  };

  private UpdateMeInternal = async (): Promise<void> => {
    const { guest, event } = await this.RequireGuest();
    const body = this.responseHelper.req.body as { displayName?: unknown };
    const guests: GuestEntry[] = await this.Query(
      `UPDATE weddingcam_guests SET display_name=$2 WHERE guestid=$1 RETURNING ${GUEST_COLUMNS};`,
      [guest.guestid, cleanDisplayName(body.displayName)]
    );
    this.Send(200, { guest: guestInfo(guests[0], event) });
  };

  /**
   * Upload one photo. The body is the raw image bytes. The client sends an Idempotency-Key (UUID)
   * so a retried upload returns the original photo instead of creating a duplicate.
   */
  private UploadPhotoInternal = async (): Promise<void> => {
    const req = this.responseHelper.req;
    const { guest, event } = await this.RequireGuest();
    if (!event.uploads_open) throw new WeddingCamError(403, "uploads_closed", "Uploads are closed for this event");

    const idempotencyKey = req.get("idempotency-key") ?? "";
    if (!UUID_RE.test(idempotencyKey)) throw new WeddingCamError(400, "invalid_idempotency_key");

    await this.RateLimit("upload-guest", guest.guestid, limits.uploadPerGuest);
    await this.RateLimit("upload-ip", clientIp(req), limits.uploadPerIp);

    const photoId = derivePhotoId(guest.guestid, idempotencyKey);
    const existing = await this.FindPhoto(event.eventid, photoId);
    if (existing) {
      return this.Send(200, { photo: await toApiPhoto(existing), ...(await this.ShotSummary(guest.guestid, event)) });
    }

    // Cheap checks before doing any image work.
    if (Number(req.get("content-length") ?? "0") > limits.maxUploadBytes) {
      throw new WeddingCamError(413, "too_large", "That photo is too large");
    }
    if (event.shot_limit > 0 && guest.shot_count >= event.shot_limit) {
      throw new WeddingCamError(403, "shot_limit", "You've used all your shots");
    }

    const body = await readRawBody(req, limits.maxUploadBytes);
    if (body.length === 0) throw new WeddingCamError(400, "empty_body", "No photo was sent");

    const image = await processImage(body);
    const bytes = image.full.length + image.thumb.length;
    // Object names are server-chosen; re-uploading the same keys on a retry is harmless.
    const keys = [objectPaths.original(event.eventid, photoId), objectPaths.thumb(event.eventid, photoId)];
    await Promise.all([putJpeg(keys[0], image.full), putJpeg(keys[1], image.thumb)]);

    try {
      // The guest and event rows stay locked from here until the request commits, so these
      // updates come last to keep concurrent uploads from waiting on each other.
      const guests: GuestEntry[] = await this.Query(
        `UPDATE weddingcam_guests SET shot_count=shot_count+1 WHERE guestid=$1 AND ($2=0 OR shot_count<$2) RETURNING ${GUEST_COLUMNS};`,
        [guest.guestid, event.shot_limit]
      );
      if (guests.length === 0) throw new WeddingCamError(403, "shot_limit", "You've used all your shots");

      const counted = await this.Query(
        "UPDATE weddingcam_events SET photo_count=photo_count+1, total_bytes=total_bytes+$2 WHERE eventid=$1 AND photo_count<max_photos RETURNING eventid;",
        [event.eventid, bytes]
      );
      if (counted.length === 0) throw new WeddingCamError(403, "event_full", "This event has reached its photo limit");

      const photos: PhotoEntry[] = await this.Query(
        "INSERT INTO weddingcam_photos (photoid, eventid, guestid, display_name, width, height, bytes, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (photoid) DO NOTHING RETURNING *;",
        [
          photoId,
          event.eventid,
          guest.guestid,
          guests[0].display_name,
          image.width,
          image.height,
          bytes,
          event.moderation === "approval" ? "pending" : "visible",
          new Date().toISOString(),
        ]
      );
      if (photos.length === 0) throw new WeddingCamError(409, "duplicate_upload");

      this.Send(201, {
        photo: await toApiPhoto(photos[0]),
        pendingApproval: photos[0].status === "pending",
        ...guestShots(guests[0], event),
      });
    } catch (error) {
      if (!(error instanceof WeddingCamError)) throw error;
      // Undo this attempt's counts, then check whether a concurrent retry of the same upload
      // saved the photo first (it uses the same object keys, so they must not be deleted).
      await this.RollbackToSavepoint();
      const winner = await this.FindPhoto(event.eventid, photoId);
      if (winner) {
        return this.Send(200, { photo: await toApiPhoto(winner), ...(await this.ShotSummary(guest.guestid, event)) });
      }
      await deleteObjects(keys).catch(() => undefined);
      throw error;
    }
  };

  private ListPhotosInternal = async (): Promise<void> => {
    const { guest, event } = await this.RequireGuest();
    if (!event.gallery_open) throw new WeddingCamError(403, "gallery_closed", "The gallery is closed");
    await this.RateLimit("list-guest", guest.guestid, limits.listPerGuest);

    const revealAt = event.reveal_at ? event.reveal_at.toISOString() : null;
    if (event.reveal_at && event.reveal_at.getTime() > Date.now()) {
      return this.Send(200, { photos: [], cursor: null, developing: true, revealAt });
    }
    const page = await this.ListPage(event.eventid, ["visible"], this.responseHelper.req.query.cursor);
    this.Send(200, {
      photos: await Promise.all(page.photos.map((p) => toApiPhoto(p))),
      cursor: page.cursor,
      developing: false,
      revealAt,
    });
  };

  private ListEventsInternal = async (): Promise<void> => {
    const events: EventEntry[] = await this.Query("SELECT * FROM weddingcam_events ORDER BY created_at DESC;", []);
    this.Send(200, { events: events.map(adminEvent) });
  };

  private CreateEventInternal = async (): Promise<void> => {
    const settings = parseSettings(this.responseHelper.req.body);
    if (!settings.name) throw new WeddingCamError(400, "invalid_settings", "name is required");

    const key = newSecret();
    // Ids are random, so retry the rare collision with a new one.
    for (let attempt = 0; attempt < 5; attempt++) {
      const events: EventEntry[] = await this.Query(
        "INSERT INTO weddingcam_events (eventid, name, key_hash, uploads_open, gallery_open, shot_limit, moderation, reveal_at, max_photos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (eventid) DO NOTHING RETURNING *;",
        [
          newEventId(),
          settings.name,
          hashSecret(key),
          settings.uploadsOpen ?? true,
          settings.galleryOpen ?? true,
          settings.shotLimit ?? limits.defaultShotLimit,
          settings.moderation ?? "none",
          settings.revealAt ?? null,
          settings.maxPhotos ?? limits.defaultMaxPhotos,
        ]
      );
      if (events.length > 0) {
        console.log(`WeddingCam event ${events[0].eventid} created.`);
        // The key is returned exactly once. Only its hash is stored.
        return this.Send(201, { event: adminEvent(events[0]), key });
      }
    }
    throw new Error("Could not allocate a unique WeddingCam event id.");
  };

  private GetEventInternal = async (): Promise<void> => {
    this.Send(200, { event: adminEvent(await this.RequireEvent()) });
  };

  private UpdateEventInternal = async (): Promise<void> => {
    const eventId = eventIdParam(this.responseHelper.req.params.eventId);
    const s = parseSettings(this.responseHelper.req.body);
    // A null parameter leaves that column unchanged. revealAt can be cleared, so it has a flag.
    const events: EventEntry[] = await this.Query(
      `UPDATE weddingcam_events SET name=COALESCE($2, name), uploads_open=COALESCE($3, uploads_open), gallery_open=COALESCE($4, gallery_open),
        shot_limit=COALESCE($5, shot_limit), max_photos=COALESCE($6, max_photos), moderation=COALESCE($7, moderation),
        reveal_at=CASE WHEN $8 THEN $9::timestamptz ELSE reveal_at END
       WHERE eventid=$1 RETURNING *;`,
      [
        eventId,
        s.name ?? null,
        s.uploadsOpen ?? null,
        s.galleryOpen ?? null,
        s.shotLimit ?? null,
        s.maxPhotos ?? null,
        s.moderation ?? null,
        s.revealAt !== undefined,
        s.revealAt ?? null,
      ]
    );
    if (events.length === 0) throw new WeddingCamError(404, "event_not_found");
    this.Send(200, { event: adminEvent(events[0]) });
  };

  /** Issues a new QR secret. Every existing guest session stops working immediately. */
  private RotateKeyInternal = async (): Promise<void> => {
    const eventId = eventIdParam(this.responseHelper.req.params.eventId);
    const key = newSecret();
    const events: EventEntry[] = await this.Query(
      "UPDATE weddingcam_events SET key_hash=$2, secret_version=secret_version+1 WHERE eventid=$1 RETURNING *;",
      [eventId, hashSecret(key)]
    );
    if (events.length === 0) throw new WeddingCamError(404, "event_not_found");
    console.log(`WeddingCam event ${eventId} key rotated.`);
    this.Send(200, { event: adminEvent(events[0]), key });
  };

  private ListEventPhotosInternal = async (): Promise<void> => {
    const req = this.responseHelper.req;
    const eventId = eventIdParam(req.params.eventId);
    const status = req.query.status;
    if (status !== undefined && !PHOTO_STATUSES.includes(status as PhotoStatus)) {
      throw new WeddingCamError(400, "invalid_status");
    }
    const page = await this.ListPage(eventId, status ? [status as PhotoStatus] : null, req.query.cursor);
    this.Send(200, {
      photos: await Promise.all(page.photos.map((p) => toApiPhoto(p, { includeStatus: true }))),
      cursor: page.cursor,
    });
  };

  private UpdatePhotoInternal = async (): Promise<void> => {
    const req = this.responseHelper.req;
    const status = (req.body as { status?: unknown }).status;
    if (!PHOTO_STATUSES.includes(status as PhotoStatus)) throw new WeddingCamError(400, "invalid_status");
    const photos: PhotoEntry[] = await this.Query(
      "UPDATE weddingcam_photos SET status=$3 WHERE eventid=$1 AND photoid=$2 RETURNING *;",
      [eventIdParam(req.params.eventId), photoIdParam(req.params.photoId), status as PhotoStatus]
    );
    if (photos.length === 0) throw new WeddingCamError(404, "photo_not_found");
    this.Send(200, { photo: await toApiPhoto(photos[0], { includeStatus: true }) });
  };

  private DeletePhotoInternal = async (): Promise<void> => {
    const req = this.responseHelper.req;
    const eventId = eventIdParam(req.params.eventId);
    const photo = await this.FindPhoto(eventId, photoIdParam(req.params.photoId));
    if (!photo) throw new WeddingCamError(404, "photo_not_found");
    // With bucket versioning on, S3 keeps a recoverable copy.
    await deleteObjects([objectPaths.original(eventId, photo.photoid), objectPaths.thumb(eventId, photo.photoid)]);
    await this.Query("DELETE FROM weddingcam_photos WHERE photoid=$1;", [photo.photoid]);
    await this.Query(
      "UPDATE weddingcam_events SET photo_count=GREATEST(photo_count-1, 0), total_bytes=GREATEST(total_bytes-$2, 0) WHERE eventid=$1;",
      [eventId, photo.bytes]
    );
    console.log(`WeddingCam photo ${eventId}/${photo.photoid} deleted.`);
    this.Send(204);
  };

  /**
   * Streams every visible photo into a zip in S3 and returns a download link.
   * JPEGs are already compressed, so entries are stored rather than deflated.
   */
  private ExportPhotosInternal = async (): Promise<void> => {
    const event = await this.RequireEvent();
    // Big events take longer than the API's usual 60 second request timeout.
    this.responseHelper.res.setTimeout(0);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const zipKey = objectPaths.export(event.eventid, stamp);
    const archive = archiver("zip", { store: true });
    // archiver makes a userland stream, which the S3 uploader doesn't accept, so pipe it into a native one.
    const upload = uploadStream(zipKey, archive.pipe(new PassThrough()), "application/zip");
    // Errors are handled below; this stops an early failure from crashing the process meanwhile.
    upload.catch(() => undefined);

    let count = 0;
    let cursor: string | null = null;
    try {
      do {
        const page: PhotoPage = await this.ListPage(event.eventid, ["visible"], cursor ?? undefined, 100);
        for (const p of page.photos) {
          const data = await getObject(objectPaths.original(event.eventid, p.photoid));
          const entryWritten = new Promise((resolve) => archive.once("entry", resolve));
          count += 1;
          const who = p.display_name ? `-${p.display_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 30)}` : "";
          archive.append(data, { name: `${String(count).padStart(5, "0")}${who}-${p.photoid.slice(0, 8)}.jpg`, date: p.created_at });
          // Backpressure: keep at most one photo buffered. Stop early if the upload fails.
          await Promise.race([entryWritten, upload]);
        }
        cursor = page.cursor;
      } while (cursor);
      await archive.finalize();
      await upload;
    } catch (error) {
      archive.abort();
      throw error;
    }

    console.log(`WeddingCam exported ${count} photos for ${event.eventid}.`);
    const safeName = event.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-") || event.eventid;
    const url = await readUrl(zipKey, { downloadName: `${safeName}-photos.zip` });
    this.Send(200, { url, count });
  };

  /** Runs a guest route. These have no mock version, since guests aren't ecosystem users. */
  private RunGuest = (handler: () => Promise<void>): Promise<void> => {
    const run = this.Catch(handler);
    return this.HandleRequest(run, run);
  };

  /**
   * Runs a host route, only for requests made from the WeddingCam app. validateUser checks the
   * user belongs to the app they send, so without this a user of any other app could manage events.
   */
  private RunHost = (handler: () => Promise<void>): Promise<void> => {
    const authorized = async (): Promise<void> => {
      const appid = process.env.WEDDINGCAM_APPLICATION_ID;
      if (!appid) {
        throw new WeddingCamError(500, "not_configured", "WEDDINGCAM_APPLICATION_ID is not configured on the server.");
      }
      // Read the app id from the same place validateUser does.
      const req = this.responseHelper.req;
      const reqBody = (req.body && req.body.clientid ? req.body : req.query) as BaseRequest;
      if (reqBody.appid !== appid || req.body.isMock !== false) {
        throw new WeddingCamError(403, "forbidden", "You don't have access to WeddingCam.");
      }
      await handler();
    };
    return this.HandleRequest(this.Catch(authorized), this.Catch(authorized));
  };

  /** Turns WeddingCamErrors into JSON responses and undoes the request's database changes. */
  private Catch = (handler: () => Promise<void>) => async (): Promise<void> => {
    try {
      await handler();
    } catch (error) {
      if (!(error instanceof WeddingCamError)) throw error;
      await this.RollbackToSavepoint();
      if (typeof error.details?.retryAfter === "number") {
        this.responseHelper.res.set("Retry-After", String(error.details.retryAfter));
      }
      this.Send(error.status, { error: error.code, message: error.message, ...error.details });
    }
  };

  /** Rolls back everything except recorded rate-limit hits. */
  private RollbackToSavepoint = async (): Promise<void> => {
    if (this.hasSavepoint) {
      await this.database.PerformFormattedQuery("ROLLBACK TO SAVEPOINT weddingcam_work;");
    } else {
      await this.database.Rollback();
    }
  };

  private Send = (status: number, body?: object): void => {
    const res = this.responseHelper.res;
    res.status(status).set("Cache-Control", "no-store");
    if (body) {
      res.write(JSON.stringify(body));
    }
    this.responseHelper.next();
  };

  private Query = (text: string, values: Values): Promise<any[]> => this.database.PerformQuery({ text, values });

  /**
   * Sliding-window rate limit. Throws 429 once `max` requests were made by `key` within the last
   * `windowSeconds`. Only inserts rows, so busy keys (a venue's shared IP) never contend for a lock.
   */
  private RateLimit = async (scope: string, key: string, [max, windowSeconds]: readonly [number, number]) => {
    const rows: { count: number; retry: number | null }[] = await this.Query(
      "SELECT count(*)::int AS count, ceil(extract(epoch FROM min(at) + make_interval(secs => $3) - now()))::int AS retry FROM weddingcam_rate_hits WHERE scope=$1 AND key=$2 AND at > now() - make_interval(secs => $3);",
      [scope, key, windowSeconds]
    );
    if (rows[0].count >= max) {
      throw new WeddingCamError(429, "rate_limited", "Too many requests, slow down a little", {
        retryAfter: Math.max(1, rows[0].retry ?? windowSeconds),
      });
    }
    await this.Query("INSERT INTO weddingcam_rate_hits (scope, key) VALUES ($1, $2);", [scope, key]);
    if (Math.random() < 0.01) {
      await this.Query("DELETE FROM weddingcam_rate_hits WHERE at < now() - interval '1 hour';", []);
    }
    await this.database.PerformFormattedQuery("SAVEPOINT weddingcam_work;");
    this.hasSavepoint = true;
  };

  private BearerToken = (): string | null => {
    const match = /^Bearer (\S+)$/i.exec(this.responseHelper.req.get("authorization") ?? "");
    return match && SECRET_RE.test(match[1]) ? match[1] : null;
  };

  /** Resolves the caller's guest token and its event, rejecting tokens from a rotated QR secret. */
  private RequireGuest = async (): Promise<{ guest: GuestEntry; event: EventEntry }> => {
    const token = this.BearerToken();
    if (!token) throw new WeddingCamError(401, "no_session", "Scan the event QR code to join");
    const rows: (EventEntry & { guestid: string; guest_secret_version: number; display_name: string; shot_count: number; expired: boolean })[] =
      await this.Query(
        "SELECT e.*, g.guestid, g.secret_version AS guest_secret_version, g.display_name, g.shot_count, g.session_expires_at <= now() AS expired FROM weddingcam_guests g JOIN weddingcam_events e ON e.eventid=g.eventid WHERE g.token_hash=$1;",
        [hashSecret(token)]
      );
    const row = rows[0];
    if (!row) throw new WeddingCamError(401, "no_session", "Scan the event QR code to join");
    if (row.expired || row.guest_secret_version !== row.secret_version) {
      throw new WeddingCamError(401, "session_expired", "This link is no longer valid. Scan the latest QR code");
    }
    const { guestid, guest_secret_version, display_name, shot_count, expired: _expired, ...event } = row;
    return {
      guest: { guestid, eventid: event.eventid, secret_version: guest_secret_version, display_name, shot_count },
      event,
    };
  };

  private FindEvent = async (eventId: string): Promise<EventEntry | undefined> => {
    const events: EventEntry[] = await this.Query("SELECT * FROM weddingcam_events WHERE eventid=$1;", [eventId]);
    return events[0];
  };

  private RequireEvent = async (): Promise<EventEntry> => {
    const event = await this.FindEvent(eventIdParam(this.responseHelper.req.params.eventId));
    if (!event) throw new WeddingCamError(404, "event_not_found");
    return event;
  };

  private FindPhoto = async (eventId: string, photoId: string): Promise<PhotoEntry | undefined> => {
    const photos: PhotoEntry[] = await this.Query("SELECT * FROM weddingcam_photos WHERE eventid=$1 AND photoid=$2;", [
      eventId,
      photoId,
    ]);
    return photos[0];
  };

  private ShotSummary = async (guestId: string, event: EventEntry) => {
    const guests: GuestEntry[] = await this.Query(`SELECT ${GUEST_COLUMNS} FROM weddingcam_guests WHERE guestid=$1;`, [guestId]);
    return guestShots(guests[0], event);
  };

  /** Newest-first page of photos, optionally limited to some statuses. */
  private ListPage = async (
    eventId: string,
    statuses: PhotoStatus[] | null,
    rawCursor: unknown,
    pageSize: number = limits.galleryPageSize
  ): Promise<PhotoPage> => {
    const after = decodeCursor(rawCursor);
    // Read one extra row to learn whether there's another page.
    const rows: PhotoEntry[] = await this.Query(
      "SELECT * FROM weddingcam_photos WHERE eventid=$1 AND ($2::text IS NULL OR status=ANY(string_to_array($2, ','))) AND ($3::timestamptz IS NULL OR (created_at, photoid) < ($3::timestamptz, $4::text)) ORDER BY created_at DESC, photoid DESC LIMIT $5;",
      [eventId, statuses ? statuses.join(",") : null, after?.createdAt ?? null, after?.photoId ?? null, pageSize + 1]
    );
    const photos = rows.slice(0, pageSize);
    const last = photos[photos.length - 1];
    return { photos, cursor: rows.length > pageSize ? encodeCursor(last.created_at, last.photoid) : null };
  };
}

type PhotoPage = { photos: PhotoEntry[]; cursor: string | null };

const GUEST_COLUMNS = "guestid, eventid, secret_version, display_name, shot_count";

const eventIdParam = (id: unknown): string => {
  if (typeof id !== "string" || !EVENT_ID_RE.test(id)) throw new WeddingCamError(400, "invalid_event_id");
  return id;
};

const photoIdParam = (id: unknown): string => {
  if (typeof id !== "string" || !PHOTO_ID_RE.test(id)) throw new WeddingCamError(400, "invalid_photo_id");
  return id;
};

/** The subset of event settings guests are allowed to see. */
const publicEvent = (event: EventEntry) => ({
  id: event.eventid,
  name: event.name,
  uploadsOpen: event.uploads_open,
  galleryOpen: event.gallery_open,
  shotLimit: event.shot_limit,
  revealAt: event.reveal_at ? event.reveal_at.toISOString() : null,
});

const adminEvent = (event: EventEntry) => ({
  ...publicEvent(event),
  secretVersion: event.secret_version,
  moderation: event.moderation,
  maxPhotos: event.max_photos,
  createdAt: event.created_at.toISOString(),
  stats: { photoCount: event.photo_count, totalBytes: Number(event.total_bytes) },
});

const guestShots = (guest: GuestEntry, event: EventEntry) => ({
  shotsTaken: guest.shot_count,
  shotsRemaining: event.shot_limit > 0 ? Math.max(0, event.shot_limit - guest.shot_count) : null,
});

const guestInfo = (guest: GuestEntry, event: EventEntry) => ({
  displayName: guest.display_name || null,
  ...guestShots(guest, event),
});

/** Builds the API shape for a photo, including short-lived read links. */
const toApiPhoto = async (p: PhotoEntry, opts: { includeStatus?: boolean } = {}) => {
  const original = objectPaths.original(p.eventid, p.photoid);
  const [thumbUrl, fullUrl, downloadUrl] = await Promise.all([
    readUrl(objectPaths.thumb(p.eventid, p.photoid)),
    readUrl(original),
    readUrl(original, { downloadName: `weddingcam-${p.photoid.slice(0, 8)}.jpg` }),
  ]);
  return {
    id: p.photoid,
    displayName: p.display_name || null,
    width: p.width,
    height: p.height,
    createdAt: p.created_at.toISOString(),
    thumbUrl,
    fullUrl,
    downloadUrl,
    ...(opts.includeStatus ? { status: p.status } : {}),
  };
};

/** Validates the editable event settings in a request body. Unknown fields are ignored. */
const parseSettings = (body: Record<string, unknown>): EventSettings => {
  const out: EventSettings = {};
  const bad = (field: string, why: string) => new WeddingCamError(400, "invalid_settings", `${field} ${why}`);
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > limits.eventNameMaxLength) {
      throw bad("name", `must be 1-${limits.eventNameMaxLength} characters`);
    }
    out.name = body.name.trim();
  }
  for (const flag of ["uploadsOpen", "galleryOpen"] as const) {
    if (body[flag] !== undefined) {
      if (typeof body[flag] !== "boolean") throw bad(flag, "must be true or false");
      out[flag] = body[flag] as boolean;
    }
  }
  if (body.shotLimit !== undefined) {
    const n = body.shotLimit;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1000) {
      throw bad("shotLimit", "must be 0-1000 (0 = unlimited)");
    }
    out.shotLimit = n;
  }
  if (body.maxPhotos !== undefined) {
    const n = body.maxPhotos;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 100_000) throw bad("maxPhotos", "must be 1-100000");
    out.maxPhotos = n;
  }
  if (body.moderation !== undefined) {
    if (body.moderation !== "none" && body.moderation !== "approval") throw bad("moderation", 'must be "none" or "approval"');
    out.moderation = body.moderation;
  }
  if (body.revealAt !== undefined) {
    const r = body.revealAt;
    if (r === null || r === "") out.revealAt = null;
    else if (typeof r === "string" && !Number.isNaN(Date.parse(r))) out.revealAt = new Date(r).toISOString();
    else throw bad("revealAt", "must be an ISO date-time or null");
  }
  return out;
};

export default WeddingCamHandler;

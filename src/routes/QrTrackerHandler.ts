import { randomBytes } from "crypto";
import { IDatabaseConnection, QueryProps } from "../utils/database";
import { ErrorStatusCode, HttpStatusCode, ResponseHelper, SuccessfulStatusCode } from "../utils/response";
import BaseRouteHandler from "./BaseRouteHandler";
import { BaseRequest } from "../types";
import { CreateQrCodeRequest, QrCode, QrCodeEntry, QrVisit, UpdateQrCodeRequest } from "../qrtracker/types";

// Columns returned for a QR code, named the way the web app expects them.
const CODE_COLUMNS =
  'codeid AS id, name, target_url AS "targetUrl", created_at AS "createdAt", visit_count AS "visitCount", last_visit_at AS "lastVisitAt"';

const ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const newCodeId = (length: number = 22): string => {
  return Array.from(randomBytes(length), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
};

const isValidCodeId = (id: unknown): id is string => typeof id === "string" && /^[0-9A-Za-z]{1,32}$/.test(id);

// Returns the url if it's a valid http(s) url, otherwise null.
const normalizeUrl = (value: unknown): string | null => {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const normalizeName = (value: unknown): string => String(value ?? "").trim().slice(0, 200);

// Returns null for a missing value and undefined for an invalid one.
const normalizeTimestamp = (value: unknown): string | null | undefined => {
  if (!value) {
    return null;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

class QrTrackerHandler extends BaseRouteHandler {
  private database: IDatabaseConnection;
  private responseHelper: ResponseHelper;
  // The signed-in user. Set by Authorized before any handler that reads or changes codes.
  private userid: string = "";
  constructor(database: IDatabaseConnection, responseHelper: ResponseHelper) {
    super(responseHelper.req, responseHelper.next);
    this.database = database;
    this.responseHelper = responseHelper;
  }

  public async Redirect(): Promise<void> {
    // Scan links are public, so there's no mock version.
    this.HandleRequest(this.RedirectInternal, this.RedirectInternal);
  }

  public async ListCodes(): Promise<void> {
    this.HandleRequest(this.Authorized(this.ListCodesInternal), this.Forbidden);
  }

  public async CreateCode(): Promise<void> {
    this.HandleRequest(this.Authorized(this.CreateCodeInternal), this.Forbidden);
  }

  public async GetCode(): Promise<void> {
    this.HandleRequest(this.Authorized(this.GetCodeInternal), this.Forbidden);
  }

  public async UpdateCode(): Promise<void> {
    this.HandleRequest(this.Authorized(this.UpdateCodeInternal), this.Forbidden);
  }

  public async DeleteCode(): Promise<void> {
    this.HandleRequest(this.Authorized(this.DeleteCodeInternal), this.Forbidden);
  }

  public async ListVisits(): Promise<void> {
    this.HandleRequest(this.Authorized(this.ListVisitsInternal), this.Forbidden);
  }

  /**
   * Record a scan, then redirect to the code's target url. This is the link
   * encoded in every QR code.
   */
  private RedirectInternal = async (): Promise<void> => {
    const req = this.responseHelper.req;
    const res = this.responseHelper.res;
    const id = req.params.id;

    let query: QueryProps = {
      text: "UPDATE qr_codes SET visit_count=visit_count+1, last_visit_at=now() WHERE codeid=$1 RETURNING target_url;",
      values: [isValidCodeId(id) ? id : ""],
    };
    const codes: { target_url: string }[] = await this.database.PerformQuery(query);
    if (codes.length === 0) {
      res.status(ErrorStatusCode.NotFound).type("text/plain; charset=utf-8");
      res.write("This QR code link does not exist.");
      return this.responseHelper.next();
    }

    query = {
      text: "INSERT INTO qr_visits (codeid, user_agent, referer) VALUES ($1, $2, $3);",
      values: [id, (req.get("user-agent") ?? "").slice(0, 512), (req.get("referer") ?? "").slice(0, 512)],
    };
    await this.database.PerformQuery(query);

    // Prevent browsers from caching the redirect and skipping the tracker.
    res.set({ Location: codes[0].target_url, "Cache-Control": "no-store" });
    this.responseHelper.GenericResponse(HttpStatusCode.Found);
  };

  private ListCodesInternal = async (): Promise<void> => {
    const query: QueryProps = {
      text: `SELECT ${CODE_COLUMNS} FROM qr_codes WHERE userid=$1 ORDER BY created_at DESC;`,
      values: [this.userid],
    };
    const codes: QrCodeEntry[] = await this.database.PerformQuery(query);
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, codes.map(this.WithShortUrl));
  };

  private CreateCodeInternal = async (): Promise<void> => {
    const reqBody = this.responseHelper.req.body as CreateQrCodeRequest;
    const targetUrl = normalizeUrl(reqBody.targetUrl);
    if (!targetUrl) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "targetUrl must be a valid http(s) URL");
    }

    // Ids are random, so retry the rare collision with a new one.
    for (let attempt = 0; attempt < 5; attempt++) {
      const query: QueryProps = {
        text: `INSERT INTO qr_codes (codeid, userid, name, target_url) VALUES ($1, $2, $3, $4) ON CONFLICT (codeid) DO NOTHING RETURNING ${CODE_COLUMNS};`,
        values: [newCodeId(), this.userid, normalizeName(reqBody.name), targetUrl],
      };
      const codes: QrCodeEntry[] = await this.database.PerformQuery(query);
      if (codes.length > 0) {
        return this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Created, this.WithShortUrl(codes[0]));
      }
    }
    throw new Error("Could not allocate a unique QR code id.");
  };

  private GetCodeInternal = async (): Promise<void> => {
    const code = await this.FindCode(this.responseHelper.req.params.id);
    if (!code) {
      return this.CodeNotFound();
    }
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, this.WithShortUrl(code));
  };

  private UpdateCodeInternal = async (): Promise<void> => {
    const id = this.responseHelper.req.params.id;
    const reqBody = this.responseHelper.req.body as UpdateQrCodeRequest;

    let targetUrl: string | null = null;
    if (reqBody.targetUrl !== undefined) {
      targetUrl = normalizeUrl(reqBody.targetUrl);
      if (!targetUrl) {
        return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "targetUrl must be a valid http(s) URL");
      }
    }
    const name = reqBody.name !== undefined ? normalizeName(reqBody.name) : null;

    // A null parameter leaves that column unchanged.
    const query: QueryProps = {
      text: `UPDATE qr_codes SET name=COALESCE($3, name), target_url=COALESCE($4, target_url) WHERE codeid=$1 AND userid=$2 RETURNING ${CODE_COLUMNS};`,
      values: [isValidCodeId(id) ? id : "", this.userid, name, targetUrl],
    };
    const codes: QrCodeEntry[] = await this.database.PerformQuery(query);
    if (codes.length === 0) {
      return this.CodeNotFound();
    }
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, this.WithShortUrl(codes[0]));
  };

  private DeleteCodeInternal = async (): Promise<void> => {
    const id = this.responseHelper.req.params.id;
    // Its visits are removed by ON DELETE CASCADE.
    const query: QueryProps = {
      text: "DELETE FROM qr_codes WHERE codeid=$1 AND userid=$2 RETURNING codeid;",
      values: [isValidCodeId(id) ? id : "", this.userid],
    };
    const deleted = await this.database.PerformQuery(query);
    if (deleted.length === 0) {
      return this.CodeNotFound();
    }
    this.responseHelper.GenericResponse(HttpStatusCode.NoContent);
  };

  private ListVisitsInternal = async (): Promise<void> => {
    const req = this.responseHelper.req;
    const from = normalizeTimestamp(req.query.from);
    const to = normalizeTimestamp(req.query.to);
    if (from === undefined || to === undefined) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "from/to must be ISO timestamps");
    }

    const code = await this.FindCode(req.params.id);
    if (!code) {
      return this.CodeNotFound();
    }

    const query: QueryProps = {
      text: 'SELECT visited_at AS at, user_agent AS "userAgent", referer FROM qr_visits WHERE codeid=$1 AND ($2::timestamptz IS NULL OR visited_at>=$2) AND ($3::timestamptz IS NULL OR visited_at<$3) ORDER BY visited_at;',
      values: [code.id, from, to],
    };
    const visits: QrVisit[] = await this.database.PerformQuery(query);
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, visits);
  };

  /**
   * Only run the handler for requests made from the QR Tracker app. validateUser
   * checks the user belongs to the app they send, so without this a user of any
   * other app could manage QR codes.
   */
  private Authorized = (handler: () => Promise<void>) => async (): Promise<void> => {
    const appid = process.env.QR_APPLICATION_ID;
    if (!appid) {
      return this.responseHelper.ErrorResponse(
        ErrorStatusCode.InternalServerError,
        "QR_APPLICATION_ID is not configured on the server."
      );
    }

    // Read the app id from the same place validateUser does.
    const req = this.responseHelper.req;
    const reqBody = (req.body && req.body.clientid ? req.body : req.query) as BaseRequest;
    if (reqBody.appid !== appid || req.body.isMock !== false) {
      return this.Forbidden();
    }

    // validateUser already checked the client id, so this always finds the user.
    const query: QueryProps = {
      text: "SELECT userid FROM users WHERE clientid=$1;",
      values: [reqBody.clientid],
    };
    const users: { userid: string }[] = await this.database.PerformQuery(query);
    this.userid = users[0].userid;

    await handler();
  };

  private Forbidden = async (): Promise<void> => {
    this.responseHelper.ErrorResponse(ErrorStatusCode.Forbidden, "You don't have access to QR Tracker.");
  };

  private CodeNotFound = (): void => {
    this.responseHelper.ErrorResponse(ErrorStatusCode.NotFound, "QR code not found");
  };

  // Only finds the signed-in user's codes; anyone else's look like they don't exist.
  private FindCode = async (id: unknown): Promise<QrCodeEntry | undefined> => {
    if (!isValidCodeId(id)) {
      return undefined;
    }
    const query: QueryProps = {
      text: `SELECT ${CODE_COLUMNS} FROM qr_codes WHERE codeid=$1 AND userid=$2;`,
      values: [id, this.userid],
    };
    const codes: QrCodeEntry[] = await this.database.PerformQuery(query);
    return codes[0];
  };

  /**
   * Add the link encoded in the QR code. It's QR_PUBLIC_BASE_URL (e.g. a website
   * that forwards /r/<id> here), or this API's own /qr/r/<id> route.
   */
  private WithShortUrl = (code: QrCodeEntry): QrCode => {
    const req = this.responseHelper.req;
    const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0];
    const base = process.env.QR_PUBLIC_BASE_URL?.replace(/\/+$/, "") || `${proto}://${req.get("host")}/qr`;
    return { ...code, shortUrl: `${base}/r/${code.id}` };
  };
}

export default QrTrackerHandler;

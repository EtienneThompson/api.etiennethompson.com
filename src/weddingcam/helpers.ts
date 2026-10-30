import { Request } from "express";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const limits = {
  // Vercel rejects request bodies over 4.5 MB. Phones send photos of about 0.5-2 MB.
  maxUploadBytes: 4 * 1024 * 1024,
  maxInputPixels: 60_000_000,
  fullLongEdge: 2560,
  thumbLongEdge: 480,
  galleryPageSize: 48,
  sessionTtlDays: 30,
  displayNameMaxLength: 40,
  eventNameMaxLength: 80,
  defaultShotLimit: 27,
  defaultMaxPhotos: 5000,
  // Photo links stay valid for 1-2 hours (aligned to the hour so browsers can cache them).
  readUrlHours: 1,

  // Rate limits: [max requests, window seconds]. Venue wifi puts many guests behind one IP.
  sessionPerIp: [200, 60] as const,
  uploadPerGuest: [20, 60] as const,
  uploadPerIp: [600, 60] as const,
  listPerGuest: [120, 60] as const,
};

/** An error the client should see, sent as { error: code, message, ...details }. */
export class WeddingCamError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message ?? code);
  }
}

const EVENT_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const EVENT_ID_RE = /^[a-z0-9]{6,32}$/;
export const PHOTO_ID_RE = /^[a-f0-9]{32}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 32 random bytes, base64url encoded. Used for both QR secrets and guest tokens.
export const SECRET_RE = /^[A-Za-z0-9_-]{43}$/;

/** Short, human-friendly event identifier. It is NOT a secret and appears in the URL path. */
export const newEventId = (): string => {
  let id = "";
  for (let i = 0; i < 10; i++) id += EVENT_ID_ALPHABET[randomInt(EVENT_ID_ALPHABET.length)];
  return id;
};

/** 256 random bits, for QR secrets and guest tokens. Only their hashes are stored. */
export const newSecret = (): string => randomBytes(32).toString("base64url");

export const newGuestId = (): string => randomBytes(16).toString("hex");

export const hashSecret = (secret: string): string => createHash("sha256").update(secret, "utf8").digest("hex");

export const secretMatches = (secret: string, expectedHash: string): boolean => {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

/**
 * Photo ids are derived from the guest and the client's idempotency key, so a retried upload
 * maps to the same photo instead of creating a duplicate. Including the random guest id keeps
 * photo ids, and therefore object names, unguessable.
 */
export const derivePhotoId = (guestId: string, idempotencyKey: string): string =>
  createHash("sha256").update(`${guestId}:${idempotencyKey.toLowerCase()}`).digest("hex").slice(0, 32);

/** Trims and validates a guest-chosen display name. It is always rendered as text, never HTML. */
export const cleanDisplayName = (raw: unknown): string => {
  if (typeof raw !== "string") throw new WeddingCamError(400, "invalid_name", "Name must be text");
  const name = raw
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if ([...name].length > limits.displayNameMaxLength) {
    throw new WeddingCamError(400, "invalid_name", `Name must be at most ${limits.displayNameMaxLength} characters`);
  }
  return name;
};

/** Gallery cursors point at the last photo of the previous page: "<created_at ISO>|<photoid>". */
export const encodeCursor = (createdAt: Date, photoId: string): string =>
  Buffer.from(`${createdAt.toISOString()}|${photoId}`).toString("base64url");

export const decodeCursor = (cursor: unknown): { createdAt: string; photoId: string } | null => {
  if (cursor === undefined || cursor === "") return null;
  const invalid = new WeddingCamError(400, "invalid_cursor");
  if (typeof cursor !== "string" || cursor.length > 200) throw invalid;
  const [createdAt, photoId] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!photoId || !PHOTO_ID_RE.test(photoId) || Number.isNaN(Date.parse(createdAt))) throw invalid;
  return { createdAt, photoId };
};

/** Vercel sets x-real-ip to the caller's address and overwrites any value the client sent. */
export const clientIp = (req: Request): string => req.get("x-real-ip") ?? req.socket.remoteAddress ?? "unknown";

/** Reads the raw request body (an uploaded photo), up to maxBytes. */
export const readRawBody = async (req: Request, maxBytes: number): Promise<Buffer> => {
  // On Vercel, the platform has already read the body into req.body.
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maxBytes) throw new WeddingCamError(413, "too_large", "That photo is too large");
    return req.body;
  }
  if (req.readableEnded) return Buffer.alloc(0);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.removeAllListeners("data");
        req.resume();
        reject(new WeddingCamError(413, "too_large", "That photo is too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
};

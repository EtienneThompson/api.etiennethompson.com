import { randomBytes } from "crypto";
import { Request } from "express";

// Shared by QR Tracker and the apps that create QR Tracker codes for their users (WeddingCam).

const ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const newCodeId = (length: number = 22): string => {
  return Array.from(randomBytes(length), (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
};

export const isValidCodeId = (id: unknown): id is string => typeof id === "string" && /^[0-9A-Za-z]{1,32}$/.test(id);

export const normalizeName = (value: unknown): string => String(value ?? "").trim().slice(0, 200);

/**
 * The link encoded in a QR code. It's QR_PUBLIC_BASE_URL (e.g. a website that
 * forwards /r/<id> here), or this API's own /qr/r/<id> route.
 */
export const shortUrl = (req: Request, codeId: string): string => {
  const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0];
  const base = process.env.QR_PUBLIC_BASE_URL?.replace(/\/+$/, "") || `${proto}://${req.get("host")}/qr`;
  return `${base}/r/${codeId}`;
};

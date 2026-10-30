import sharp from "sharp";
import { limits, WeddingCamError } from "./helpers";

export type ImageKind = "jpeg" | "png" | "webp";

/** Identifies the format from the file's leading "magic" bytes. Never trust Content-Type. */
export const sniffImageType = (buf: Uint8Array): ImageKind | null => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) {
    return "png";
  }
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.subarray(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
};

export interface ProcessedImage {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/**
 * Fully decodes and re-encodes the upload. That normalizes everything to JPEG, applies the EXIF
 * orientation, drops ALL metadata (GPS, camera serials, etc.; sharp strips it unless asked not to)
 * and neutralizes malformed or polyglot files, since only decoded pixels make it to the output.
 */
export const processImage = async (buf: Buffer): Promise<ProcessedImage> => {
  if (!sniffImageType(buf)) {
    throw new WeddingCamError(415, "unsupported_type", "Only JPEG, PNG and WebP photos are accepted");
  }
  try {
    const base = sharp(buf, { limitInputPixels: limits.maxInputPixels, failOn: "error" }).rotate();
    const resize = (edge: number) => ({ width: edge, height: edge, fit: "inside" as const, withoutEnlargement: true });
    const [full, thumb] = await Promise.all([
      base
        .clone()
        .resize(resize(limits.fullLongEdge))
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer({ resolveWithObject: true }),
      base.clone().resize(resize(limits.thumbLongEdge)).jpeg({ quality: 72, mozjpeg: true }).toBuffer(),
    ]);
    return { full: full.data, thumb, width: full.info.width, height: full.info.height };
  } catch {
    throw new WeddingCamError(422, "invalid_image", "That file could not be read as a photo");
  }
};

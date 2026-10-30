import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { limits } from "./helpers";

/**
 * Photos are stored in a private S3 bucket and served through short-lived, read-only presigned
 * links. Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, like the rest of the API.
 */

export const objectPaths = {
  original: (eventId: string, photoId: string) => `originals/${eventId}/${photoId}.jpg`,
  thumb: (eventId: string, photoId: string) => `thumbs/${eventId}/${photoId}.jpg`,
  export: (eventId: string, stamp: string) => `exports/${eventId}/${stamp}.zip`,
};

let client: S3Client | undefined;

const bucket = (): string => {
  const name = process.env.WEDDINGCAM_BUCKET_NAME;
  if (!name) throw new Error("WEDDINGCAM_BUCKET_NAME is not configured on the server.");
  return name;
};

const s3 = (): S3Client => {
  // WEDDINGCAM_S3_ENDPOINT is only for local development against an S3-compatible server.
  const endpoint = process.env.WEDDINGCAM_S3_ENDPOINT;
  client ??= new S3Client({
    region: process.env.WEDDINGCAM_BUCKET_REGION || "us-west-2",
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
  return client;
};

export const putJpeg = async (key: string, data: Buffer): Promise<void> => {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: data,
      ContentType: "image/jpeg",
      // Content at a given key never changes, so browsers may cache it for as long as they like.
      CacheControl: "private, max-age=31536000, immutable",
    })
  );
};

export const getObject = async (key: string): Promise<Buffer> => {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
};

/** Deletes objects in batches of up to 1000, the most one S3 request can take. */
export const deleteObjects = async (keys: string[]): Promise<void> => {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
    const res = await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: batch, Quiet: true } }));
    if (res.Errors?.length) throw new Error(`Could not delete ${res.Errors.length} objects: ${res.Errors[0].Message}`);
  }
};

/** Streams a body of unknown length (e.g. a zip being built) into one object. */
export const uploadStream = async (key: string, body: Readable, contentType: string): Promise<void> => {
  await new Upload({ client: s3(), params: { Bucket: bucket(), Key: key, Body: body, ContentType: contentType } }).done();
};

/**
 * Returns a read-only link to one object. It's signed as of the start of the current hour, so
 * the link stays identical for the hour and browsers keep their cached copy across gallery refreshes.
 */
export const readUrl = (key: string, opts: { downloadName?: string; hours?: number } = {}): Promise<string> => {
  const hour = 3600_000;
  const signingDate = new Date(Math.floor(Date.now() / hour) * hour);
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: opts.downloadName ? `attachment; filename="${opts.downloadName}"` : undefined,
  });
  return getSignedUrl(s3(), command, { signingDate, expiresIn: ((opts.hours ?? limits.readUrlHours) + 1) * 3600 });
};

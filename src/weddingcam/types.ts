export type Moderation = "none" | "approval";

export type PhotoStatus = "visible" | "hidden" | "pending";
export const PHOTO_STATUSES: PhotoStatus[] = ["visible", "hidden", "pending"];

export type EventEntry = {
  eventid: string;
  name: string;
  key_hash: string;
  secret_version: number;
  uploads_open: boolean;
  gallery_open: boolean;
  shot_limit: number;
  moderation: Moderation;
  reveal_at: Date | null;
  max_photos: number;
  photo_count: number;
  // BIGINT columns come back from node-postgres as strings.
  total_bytes: string;
  created_at: Date;
};

export type GuestEntry = {
  guestid: string;
  eventid: string;
  secret_version: number;
  display_name: string;
  shot_count: number;
};

export type PhotoEntry = {
  photoid: string;
  eventid: string;
  guestid: string;
  display_name: string;
  width: number;
  height: number;
  bytes: number;
  status: PhotoStatus;
  created_at: Date;
};

/** The editable event settings, as sent by the host app. */
export type EventSettings = {
  name?: string;
  uploadsOpen?: boolean;
  galleryOpen?: boolean;
  shotLimit?: number;
  maxPhotos?: number;
  moderation?: Moderation;
  revealAt?: string | null;
};

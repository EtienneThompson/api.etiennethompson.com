export type QrCodeEntry = {
  id: string;
  name: string;
  targetUrl: string;
  createdAt: Date;
  visitCount: number;
  lastVisitAt: Date | null;
};

export type QrCode = QrCodeEntry & {
  // The link encoded in the QR code.
  shortUrl: string;
};

export type QrVisit = {
  at: Date;
  userAgent: string;
  referer: string;
};

export type CreateQrCodeRequest = {
  name?: string;
  targetUrl?: string;
};

export type UpdateQrCodeRequest = {
  name?: string;
  targetUrl?: string;
};

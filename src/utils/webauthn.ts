export type PasskeyChallengePurpose = "registration" | "authentication";

export type PasskeyChallengeEntry = {
  challenge: string;
  userid: string | null;
  is_valid: boolean;
};

export type PasskeyCredentialEntry = {
  credentialid: string;
  userid: string;
  // Base64url encoded public key.
  public_key: string;
  // BIGINT columns are returned as strings.
  sign_count: string;
  transports: string | null;
};

/**
 * The domain passkeys are bound to. Using the parent domain lets every
 * subdomain of etiennethompson.com use the same passkeys. This can't change
 * without every user registering their passkeys again.
 */
export const getRelyingPartyId = (): string => {
  return process.env.WEBAUTHN_RP_ID || "etiennethompson.com";
};

/**
 * The name shown to users by their passkey manager.
 */
export const getRelyingPartyName = (): string => {
  return process.env.WEBAUTHN_RP_NAME || "Etienne Thompson";
};

/**
 * The origins allowed to perform passkey ceremonies, as a comma separated list.
 */
export const getExpectedOrigins = (): string[] => {
  const origins = process.env.WEBAUTHN_ORIGINS || "https://login.etiennethompson.com";
  return origins.split(",").map((origin) => origin.trim());
};

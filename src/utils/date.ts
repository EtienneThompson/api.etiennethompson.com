/**
 * Creates a string which is 2 hours in the future from the current time.
 * @returns string ISO format date time.
 */
export const createExpiration = (): string => {
  let now = new Date();
  now.setHours(now.getHours() + 2);
  let expiration = now.toISOString();
  expiration = expiration.replace("T", " ").split(".")[0];
  return expiration;
};

/**
 * Returns the current time.
 * @returns string ISO format date time.
 */
export const getCurrentTimeField = (): string => {
  let now = new Date().toISOString();
  now = now.replace("T", " ").split(".")[0];
  return now;
};

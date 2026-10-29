import bcrypt from "bcryptjs";
import * as crypto from "crypto";

const SALT_ROUNDS = 12;

/**
 * Hash a password for storage in the database.
 * @param password The password sent by the client (already SHA-256 hashed by the front end).
 * @returns The bcrypt hash to store.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Whether a stored password is from before passwords were bcrypt hashed on the server.
 * @param storedPassword The password column from the users table.
 */
export const isLegacyPasswordHash = (storedPassword: string): boolean => {
  return !storedPassword.startsWith("$2");
};

/**
 * Check a password sent by the client against the stored password.
 * @param password The password sent by the client.
 * @param storedPassword The password column from the users table.
 * @returns Whether the password matches.
 */
export const verifyPassword = async (password: string, storedPassword: string): Promise<boolean> => {
  if (isLegacyPasswordHash(storedPassword)) {
    // TODO: Remove once every row has been migrated with src/tools/migrate_password_hashes.ts.
    const given = Buffer.from(password);
    const stored = Buffer.from(storedPassword);
    return given.length === stored.length && crypto.timingSafeEqual(given, stored);
  }

  return await bcrypt.compare(password, storedPassword);
};

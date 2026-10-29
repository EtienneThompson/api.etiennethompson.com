import { DatabaseConnection } from "../utils/database";
import { hashPassword, isLegacyPasswordHash } from "../utils/password";

require("dotenv").config({ path: `./.env.${process.env.APP_ENV || "local"}` });

/**
 * Replace every legacy SHA-256 password with a bcrypt hash of it. The front
 * end still sends the SHA-256 hash, so users keep logging in with the same
 * password. Safe to run more than once.
 */
const migrate_password_hashes = async () => {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set.");
    return;
  }

  const client = new DatabaseConnection();
  await client.InitializeByConnectionString(process.env.DATABASE_URL);
  await client.Begin();

  const users = await client.PerformQuery({
    text: "SELECT userid, password FROM users;",
    values: [],
  });

  let migrated = 0;
  for (const user of users) {
    if (!user.password || !isLegacyPasswordHash(user.password)) {
      continue;
    }

    await client.PerformQuery({
      text: "UPDATE users SET password=$1 WHERE userid=$2;",
      values: [await hashPassword(user.password), user.userid],
    });
    migrated++;
  }

  await client.Commit();
  await client.Close();
  console.log(`Migrated ${migrated} of ${users.length} passwords to bcrypt.`);
};

migrate_password_hashes();

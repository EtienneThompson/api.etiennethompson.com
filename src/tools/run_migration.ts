import * as fs from "fs";
import * as path from "path";
import { DatabaseConnection } from "../utils/database";

require("dotenv").config({ path: `./.env.${process.env.APP_ENV || "local"}` });

/**
 * Run a SQL file from the migrations folder against DATABASE_URL.
 * Usage: APP_ENV=production yarn run migrate 001_passkeys_and_bcrypt.sql
 */
const run_migration = async () => {
  const fileName = process.argv[2];
  if (!fileName) {
    console.log("Pass the migration file name, e.g. 001_passkeys_and_bcrypt.sql");
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set.");
    return;
  }

  const sql = fs.readFileSync(path.join(__dirname, "../../migrations", path.basename(fileName)), "utf8");
  const host = new URL(process.env.DATABASE_URL).hostname;
  console.log(`Running ${fileName} against ${host}...`);

  const client = new DatabaseConnection();
  await client.InitializeByConnectionString(process.env.DATABASE_URL);
  await client.PerformFormattedQuery(sql);
  await client.Close();
  console.log("Migration finished.");
};

run_migration();

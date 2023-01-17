import { DatabaseConnection } from "../utils/database";
import {
  createFieldName,
  getClientSchema,
} from "../thompsonaccounting/helpers";

require("dotenv").config({ path: `./.env.local` });

const rename_columns = async () => {
  if (
    !process.env.THOMPSON_ACCOUNTING_DATABASE_HOST ||
    !process.env.THOMPSON_ACCOUNTING_DATABASE_USER ||
    !process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD ||
    !process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE
  ) {
    return;
  }

  const client = new DatabaseConnection();
  await client.Initialize(
    process.env.THOMPSON_ACCOUNTING_DATABASE_HOST,
    process.env.THOMPSON_ACCOUNTING_DATABASE_USER,
    process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD,
    process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE,
    5432
  );

  const clientSchema = await getClientSchema(client.GetClient());

  if (!clientSchema) {
    return;
  }

  for (let tab of clientSchema.tabs) {
    for (let field of tab.fields) {
      const newFieldName = createFieldName(tab.name, field.name);

      let sql = `ALTER TABLE ${tab.name} RENAME COLUMN ${field.name} TO ${newFieldName};`;
      console.log(sql);

      await client.PerformFormattedQuery(sql);

      if (field.type === "select") {
        let sql = `ALTER TYPE ${field.name} RENAME TO ${newFieldName};`;
        console.log(sql);

        await client.PerformFormattedQuery(sql);
      }

      console.log();
    }
  }

  await client.Commit();
};

rename_columns();

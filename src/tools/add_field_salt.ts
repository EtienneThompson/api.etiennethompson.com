import {
  connectToAWSDatabase,
  performFormattedQuery,
} from "../utils/database";
import {
  createFieldName,
  getClientSchema,
} from "../thompsonaccounting/helpers";

require("dotenv").config({ path: `./.env.production` });

const rename_columns = async () => {
  if (
    !process.env.THOMPSON_ACCOUNTING_DATABASE_HOST ||
    !process.env.THOMPSON_ACCOUNTING_DATABASE_USER ||
    !process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD ||
    !process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE
  ) {
    return;
  }

  const client = await connectToAWSDatabase(
    process.env.THOMPSON_ACCOUNTING_DATABASE_HOST,
    process.env.THOMPSON_ACCOUNTING_DATABASE_USER,
    process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD,
    process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE
  );

  const clientSchema = await getClientSchema(client);

  if (!clientSchema) {
    return;
  }

  for (let tab of clientSchema.tabs) {
    for (let field of tab.fields) {
      const newFieldName = createFieldName(tab.name, field.name);

      let sql = `ALTER TABLE ${tab.name} RENAME COLUMN ${field.name} TO ${newFieldName};`;
      console.log(sql);

      let { code, rows } = await performFormattedQuery(client, sql);

      if (code !== 200) {
        console.log(code);
        console.log("ERROR!!!");
      }

      if (field.type === "select") {
        let sql = `ALTER TYPE ${field.name} RENAME TO ${newFieldName};`;
        console.log(sql);

        let { code, rows } = await performFormattedQuery(client, sql);

        if (code !== 200) {
          console.log(code);
          console.log("ERROR!!!!");
        }
      }

      console.log();
    }
  }

  await client.end();
};

rename_columns();

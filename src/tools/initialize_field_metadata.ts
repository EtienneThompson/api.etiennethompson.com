import {
  createFieldName,
  getClientSchema,
} from "../thompsonaccounting/helpers";
import {
  connectToAWSDatabase,
  performFormattedQuery,
} from "../utils/database";
import { v4 as uuidv4 } from "uuid";

require("dotenv").config({ path: `./.env.local` });

const initializeFieldMetadata = async () => {
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
    let position = 0;
    for (let field of tab.fields) {
      let metadataId = uuidv4();
      let fieldName = createFieldName(tab.name, field.name);

      let sql = `INSERT INTO field_metadata (metadata_id, tab_name, field_name, position) VALUES ('${metadataId}', '${tab.name}', '${fieldName}', ${position}) RETURNING *;`;
      console.log(sql);

      let { code, rows } = await performFormattedQuery(client, sql);
      if (code !== 200 || rows.length === 0) {
        console.log("ERROR!!!");
      }

      console.log();

      position++;
    }
  }
};

initializeFieldMetadata();

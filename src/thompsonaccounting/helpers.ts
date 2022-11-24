import { Client } from "pg";
import { performQuery, QueryProps } from "../utils/database";
import { ColumnSchemaInfo } from "./types";

export const getTableSchema = async (
  client: Client,
  tableName: string
): Promise<ColumnSchemaInfo[]> => {
  const query: QueryProps = {
    name: "GetTableSchema",
    text: "SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_name=$1;",
    values: [tableName],
  };
  const { code, rows } = await performQuery(client, query);

  if (code !== 200) {
    throw new Error(`Could not get the schema for ${tableName}`);
  }

  return rows as ColumnSchemaInfo[];
};

export const getEnumTypeValues = async (
  client: Client,
  enumName: string
): Promise<string[]> => {
  const query: QueryProps = {
    name: `get${enumName}Values`,
    text: `SELECT unnest(enum_range(null::${enumName}));`,
    values: [],
  };
  const { code, rows } = await performQuery(client, query);

  if (code !== 200) {
    throw new Error(`Could not get the enum values for ${enumName}`);
  }

  let enumValues = rows.map((value) => value.unnest);
  enumValues.splice(0, 0, "---");

  return enumValues;
};

import { Client } from "pg";
import { performQuery, QueryProps } from "../utils/database";
import {
  ClientDetails,
  ClientDetailsTab,
  ColumnType,
  ColumnSchemaInfo,
  DatabaseColumn,
  IsNullable,
} from "./types";
import { capitalize } from "../utils/string";

export const capitalizeName = (name: string): string => {
  let pieces = name.split("_");
  let ret_string: string = "";
  for (let piece of pieces) {
    piece = capitalize(piece);
    ret_string += piece + " ";
  }

  ret_string = ret_string.substring(0, ret_string.length - 1);
  return ret_string;
};

export const createColumnName = (name: string): string => {
  let pieces = name.trim().split(" ");
  let ret_string: string = "";
  for (let piece of pieces) {
    ret_string += piece.toLowerCase() + "_";
  }

  ret_string = ret_string.substring(0, ret_string.length - 1);
  return ret_string;
};

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

export const getClientSchema = async (
  client: Client
): Promise<ClientDetails | undefined> => {
  // Get all column names other than the id field.
  let tableNames = await getTableSchema(client, "clients");
  try {
    tableNames = tableNames.slice(1);
  } catch (e: any) {
    return undefined;
  }

  const clientDetailsSchema: ClientDetailsTab[] = [];

  // Get the schema for each table related to clients.
  for (let tableName of tableNames) {
    let rows;
    try {
      rows = await getTableSchema(client, tableName.column_name);
    } catch (e: any) {
      return undefined;
    }

    let fields: DatabaseColumn[] = [];

    // Convert the database schema to the UI schema.
    for (let field of rows) {
      // Skip any id fields.
      if (field.column_name.endsWith("id")) {
        continue;
      }

      // Get type and default value based on data type.
      let type: ColumnType;
      let value: any;
      let options: string[] | undefined;
      switch (field.data_type) {
        case "character varying":
          type = "text";
          value = "";
          break;
        case "boolean":
          type = "checkbox";
          value = false;
          break;
        case "text":
          type = "textarea";
          value = "";
          break;
        case "USER-DEFINED":
          type = "select";
          value = "---";

          // Get the possible values for the user defined enum.
          try {
            options = await getEnumTypeValues(client, field.udt_name);
          } catch (e: any) {
            return undefined;
          }

          break;
        default:
          type = "text";
          value = "";
          break;
      }

      let fieldSchema: DatabaseColumn = {
        name: field.column_name,
        label: capitalizeName(field.column_name),
        required: field.is_nullable === IsNullable.No,
        type: type,
        value: value,
        options: options,
      };

      fields.push(fieldSchema);
    }

    clientDetailsSchema.push({
      name: tableName.column_name,
      label: capitalizeName(tableName.column_name),
      fields: fields,
    });
  }

  let clientDetails: ClientDetails = {
    id: "",
    tabs: clientDetailsSchema,
  };

  return clientDetails;
};

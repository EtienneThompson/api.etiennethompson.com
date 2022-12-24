import { Client } from "pg";
import { performQuery, QueryProps } from "../utils/database";
import {
  ClientDetails,
  ClientDetailsTab,
  ColumnType,
  ColumnSchemaInfo,
  DatabaseColumn,
  IsNullable,
  FieldMetadata,
} from "./types";
import { capitalize } from "../utils/string";
import { get8DigitsCode } from "../utils/hash";

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

const createColumnName = (name: string): string => {
  let pieces = name.trim().split(" ");
  let ret_string: string = "";
  for (let piece of pieces) {
    ret_string += piece.toLowerCase() + "_";
  }

  ret_string = ret_string.substring(0, ret_string.length - 1);
  return ret_string;
};

export const createTabName = (name: string): string => {
  return createColumnName(name);
};

export const createFieldName = (
  tabName: string,
  fieldName: string
): string => {
  let tab = createColumnName(tabName);
  let field = createColumnName(fieldName);
  let uniqueField = computeFieldHash(tab, field);
  return uniqueField;
};

export const getFieldMetadata = async (
  client: Client,
  fieldName: string
): Promise<FieldMetadata> => {
  const query: QueryProps = {
    name: "GetFieldMetadata",
    text: "SELECT tab_name, field_name, position FROM field_metadata WHERE field_name=$1",
    values: [fieldName],
  };
  const { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    throw new Error(`Could not get the metadata for ${fieldName}`);
  }

  return rows[0] as FieldMetadata;
};

export const getFieldMetadataForTab = async (
  client: Client,
  tabName: string
): Promise<FieldMetadata[]> => {
  const query: QueryProps = {
    name: "GetFieldMetadataForTab",
    text: "SELECT tab_name, field_name, position FROM field_metadata WHERE tab_name=$1",
    values: [tabName],
  };
  const { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    throw new Error(`Could not get the metadata for ${tabName}`);
  }

  return rows as FieldMetadata[];
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

  let rowSchema = (rows as ColumnSchemaInfo[]).map((row) => {
    return {
      column_name: removeFieldHash(row.column_name),
      data_type: row.data_type,
      udt_name: row.udt_name,
      is_nullable: row.is_nullable,
    } as ColumnSchemaInfo;
  });

  return rowSchema;
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
    let tabSchema;
    try {
      tabSchema = await getTableSchema(client, tableName.column_name);
    } catch (e: any) {
      return undefined;
    }

    let fieldMetadata;
    try {
      fieldMetadata = await getFieldMetadataForTab(
        client,
        tableName.column_name
      );
    } catch (e: any) {
      return undefined;
    }

    let fields: DatabaseColumn[] = [];

    // Convert the database schema to the UI schema.
    for (let field of tabSchema) {
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

      // Find the metadata for the given field.
      let metadata = fieldMetadata.filter((m) =>
        m.field_name.includes(field.column_name)
      )[0];

      let fieldSchema: DatabaseColumn = {
        name: field.column_name,
        label: capitalizeName(field.column_name),
        required: field.is_nullable === IsNullable.No,
        type: type,
        value: value,
        position: metadata.position,
        options: options,
      };

      fields.push(fieldSchema);
    }

    // Sort fields based on their metadata position.
    fields = fields.sort((f) => f.position);

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

/**
 * Computes a unique name for a field based on the tab and field name.
 * @param tabName The name of the tab the field belongs to.
 * @param fieldName The name of the field.
 * @returns A unique string computed from the tab and field name.
 */
const computeFieldHash = (tabName: string, fieldName: string): string => {
  const hash = get8DigitsCode(tabName + fieldName);
  return `${fieldName}_${hash}`;
};

/**
 * Removes the unique hash from a stored field name.
 * @param fieldNameWithHash The field name with the unique episode.
 * @returns The field name with the hash removed.
 */
const removeFieldHash = (fieldNameWithHash: string): string => {
  let containsHash = fieldNameWithHash.match(/_[0-9]{8}/);
  if (containsHash && containsHash.length > 0) {
    return fieldNameWithHash.substring(0, fieldNameWithHash.length - 9);
  }

  return fieldNameWithHash;
};

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, performQuery } from "../utils/database";
import {
  ClientDetailsTab,
  DatabaseColumn,
  ColumnType,
  IsNullable,
} from "./types";

const capitalizeName = (name: string): string => {
  let pieces = name.split("_");
  let ret_string: string = "";
  for (let piece of pieces) {
    piece = piece.charAt(0).toUpperCase() + piece.slice(1);
    ret_string += piece + " ";
  }

  ret_string = ret_string.substring(0, ret_string.length - 1);
  return ret_string;
};

export const getClientDetails = (req: Request, res: Response, next: any) => {
  res.status(200);
  res.write("getClientDetails");
  next();
};

export const getNewClientSchema = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  let query: QueryProps = {
    name: "getClientSchema",
    text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'clients';",
    values: [],
  };
  let { code, rows } = await performQuery(client, query);

  if (code !== 200) {
    res.status(404);
    res.write(
      JSON.stringify({ message: "The client database was not found." })
    );
    next();
    return;
  }
  // Get all column names other than the id field.
  let tableNames = rows.slice(1);

  const clientDetailsSchema: ClientDetailsTab[] = [];

  // Get the schema for each table related to clients.
  for (let tableName of tableNames) {
    query = {
      name: `get${tableName.column_name}Schema`,
      text: "SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_name=$1;",
      values: [tableName.column_name],
    };
    ({ code, rows } = await performQuery(client, query));
    if (code !== 200) {
      res.status(400);
      res.write({
        message: `The auxiliary ${tableName.column_name} table was not found.`,
      });
      next();
      return;
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
          query = {
            name: `get${field.udt_name}Values`,
            text: `SELECT unnest(enum_range(null::${field.udt_name}));`,
            values: [],
          };
          ({ code, rows } = await performQuery(client, query));
          if (code !== 200) {
            res.status(404);
            res.write({ message: "User defined enum not found in database" });
            next();
            return;
          }

          options = rows.map((row) => row.unnest);

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

  res.status(200);
  res.write(JSON.stringify(clientDetailsSchema));
  next();
};

export const postNewClientDetails = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  const newClientTabs = req.body.formData as ClientDetailsTab[];

  let foreignNames: string[] = ["id"];
  let foreignKeys: string[] = [uuidv4()];
  let foreignPlaceholders: string[] = ["$1"];
  let foreignIndex = 2;

  for (let tabData of newClientTabs) {
    foreignPlaceholders.push(`$${foreignIndex}`);
    foreignIndex++;
    // Get the list of column names to update.
    let insertNames: string = `${tabData.name}_id, `;
    let valuePlaceholders: string = "$1, ";
    let values: (string | boolean)[] = [];
    let index = 2;
    for (let fieldData of tabData.fields) {
      insertNames += fieldData.name + ", ";
      valuePlaceholders += `$${index}, `;
      index++;
      values.push(fieldData.value);
    }
    insertNames = insertNames.substring(0, insertNames.length - 2);
    valuePlaceholders = valuePlaceholders.substring(
      0,
      valuePlaceholders.length - 2
    );

    let tableId = uuidv4();
    values.splice(0, 0, tableId);
    foreignNames.push(tabData.name);
    foreignKeys.push(tableId);

    let query: QueryProps = {
      name: `insert${tabData.name}Entry`,
      text: `INSERT INTO ${tabData.name} (${insertNames}) VALUES (${valuePlaceholders});`,
      values: values,
    };
    let { code, rows } = await performQuery(client, query);
    if (code !== 200) {
      res.status(500);
      res.write(
        JSON.stringify({ message: `Unable to insert into ${tabData.name}.` })
      );
      next();
      return;
    }
  }

  let query: QueryProps = {
    name: "insertClientEntry",
    text: `INSERT INTO clients (${foreignNames.join(
      ", "
    )}) VALUES (${foreignPlaceholders.join(", ")});`,
    values: foreignKeys,
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(500);
    res.write(JSON.stringify({ message: "Unable to insert into clients." }));
    next();
    return;
  }

  res.status(200);
  res.write("postNewClientDetails");
  next();
};

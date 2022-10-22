import { Request, Response } from "express";
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

    let fields: DatabaseColumn[] = [];

    for (let field of rows) {
      if (field.column_name.includes("id")) {
        continue;
      }

      let type: ColumnType;
      let value: any;
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

export const postNewClientDetails = (
  req: Request,
  res: Response,
  next: any
) => {
  res.status(200);
  res.write("postNewClientDetails");
  next();
};

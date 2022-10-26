import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, performQuery } from "../utils/database";
import {
  ClientDetailsTab,
  DatabaseColumn,
  ColumnType,
  IsNullable,
  InsertedEntry,
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

const deleteInsertedEntries = async (
  client: any,
  insertedEntries: InsertedEntry[]
): Promise<void> => {
  for (let entry of insertedEntries) {
    let query: QueryProps = {
      name: `delete${entry.tableName}Entry`,
      text: `DELETE FROM ${entry.tableName} WHERE ${entry.tableName}_id = $1`,
      values: [entry.id],
    };
    let { code, rows } = await performQuery(client, query);
    if (code !== 200) {
      console.log(
        `Entry ${entry.id} failed to delete from table ${entry.tableName}`
      );
    } else {
      console.log(
        `Successfully delete entry ${entry.id} from table ${entry.tableName}`
      );
    }
  }
};

export const getClientDetails = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  let clientDetails: ClientDetailsTab[][] = [];

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

  // Get all the entries in the clients database.
  query = {
    name: "getClientEntries",
    text: "SELECT * from clients;",
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({ message: "The clients entries couldn't be fetched." })
    );
    next();
    return;
  }

  let clientEntries = rows;

  for (let entry of clientEntries) {
    const clientDetailsTabs: ClientDetailsTab[] = [];

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
        res.write(
          JSON.stringify({
            message: `The auxiliary ${tableName.column_name} table was not found.`,
          })
        );
        next();
        return;
      }
      let tableSchema = rows;

      query = {
        name: `get${tableName.column_name}Entries`,
        text: `SELECT * FROM ${tableName.column_name} WHERE ${tableName.column_name}_id = $1`,
        values: [entry[tableName.column_name]],
      };
      ({ code, rows } = await performQuery(client, query));
      if (code !== 200) {
        res.status(400);
        res.write(
          JSON.stringify({
            message: `The entries of the ${tableName.column_name} couldn't be fetched.`,
          })
        );
        next();
        return;
      }
      let tableValues = rows[0];

      let fields: DatabaseColumn[] = [];

      let index = 0;
      // Convert the database schema to the UI schema.
      for (let field of tableSchema) {
        // Skip any id fields.
        if (field.column_name.endsWith("id")) {
          continue;
        }

        // Get type and default value based on data type.
        let type: ColumnType;
        let value = tableValues[field.column_name];
        let options: string[] | undefined;
        switch (field.data_type) {
          case "character varying":
            type = "text";
            break;
          case "boolean":
            type = "checkbox";
            break;
          case "text":
            type = "textarea";
            break;
          case "USER-DEFINED":
            type = "select";

            // Get the possible values for the user defined enum.
            query = {
              name: `get${field.udt_name}Values`,
              text: `SELECT unnest(enum_range(null::${field.udt_name}));`,
              values: [],
            };
            ({ code, rows } = await performQuery(client, query));
            if (code !== 200) {
              res.status(404);
              res.write({
                message: "User defined enum not found in database",
              });
              next();
              return;
            }

            options = rows.map((row) => row.unnest);
            if (options !== undefined) {
              options.splice(0, 0, "---");
            }

            break;
          default:
            type = "text";
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

        index++;
      }

      clientDetailsTabs.push({
        name: tableName.column_name,
        label: capitalizeName(tableName.column_name),
        fields: fields,
      });
    }

    clientDetails.push(clientDetailsTabs);
  }

  res.status(200);
  res.write(JSON.stringify(clientDetails));
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
          if (options !== undefined) {
            options.splice(0, 0, "---");
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

  const insertedEntries: InsertedEntry[] = [];

  let foreignNames: string[] = ["id"];
  let foreignKeys: string[] = [uuidv4()];
  let foreignPlaceholders: string[] = ["$1"];
  let foreignIndex = 2;

  // Write an entry to each auxiliary table.
  for (let tabData of newClientTabs) {
    foreignPlaceholders.push(`$${foreignIndex}`);
    foreignIndex++;
    // Get the list of column names and values to insert.
    let insertNames: string = `${tabData.name}_id, `;
    let valuePlaceholders: string = "$1, ";
    let values: (string | boolean)[] = [];
    let index = 2;
    for (let fieldData of tabData.fields) {
      if (
        (fieldData.required && fieldData.value === "") ||
        fieldData.value === "---"
      ) {
        await deleteInsertedEntries(client, insertedEntries);
        res.status(400);
        res.write(
          JSON.stringify({
            message: `The required parameter ${fieldData.label} was not set`,
          })
        );
        next();
        return;
      }

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
      await deleteInsertedEntries(client, insertedEntries);
      res.status(500);
      res.write(
        JSON.stringify({ message: `Unable to insert into ${tabData.name}.` })
      );
      next();
      return;
    }

    insertedEntries.push({
      tableName: tabData.name,
      id: tableId,
    });
  }

  // Write the entry to the main clients table.
  let query: QueryProps = {
    name: "insertClientEntry",
    text: `INSERT INTO clients (${foreignNames.join(
      ", "
    )}) VALUES (${foreignPlaceholders.join(", ")});`,
    values: foreignKeys,
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    await deleteInsertedEntries(client, insertedEntries);
    res.status(500);
    res.write(JSON.stringify({ message: "Unable to insert into clients." }));
    next();
    return;
  }

  res.status(200);
  next();
};

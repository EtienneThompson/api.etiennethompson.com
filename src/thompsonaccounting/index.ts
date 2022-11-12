import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Map } from "../types";
import {
  QueryProps,
  performQuery,
  connectToAWSDatabase,
} from "../utils/database";
import { capitalize, isNullOrWhiteSpace } from "../utils/string";
import { getEnumTypeValues, getTableSchema } from "./helpers";
import {
  ClientDetails,
  ClientDetailsTab,
  DatabaseColumn,
  ColumnType,
  IsNullable,
  InsertedEntry,
  ColumnSchemaInfo,
  ColumnMap,
} from "./types";

const capitalizeName = (name: string): string => {
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
  let pieces = name.split(" ");
  let ret_string: string = "";
  for (let piece of pieces) {
    ret_string += piece.toLowerCase() + "_";
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

const getSingleClientDetails = async (
  entry: Map,
  tableNames: ColumnSchemaInfo[]
): Promise<ClientDetails> => {
  let client = await connectToAWSDatabase(
    process.env.THOMPSON_ACCOUNTING_DATABASE_HOST as string,
    process.env.THOMPSON_ACCOUNTING_DATABASE_USER as string,
    process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD as string,
    process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE as string
  );
  const clientDetailsTabs: ClientDetailsTab[] = [];

  // Get the schema for each table related to clients.
  for (let tableName of tableNames) {
    let tableSchema = await getTableSchema(client, tableName.column_name);

    let tableValues: ColumnMap = {};
    if (!isNullOrWhiteSpace(entry[tableName.column_name])) {
      let query = {
        name: `get${tableName.column_name}Entries`,
        text: `SELECT * FROM ${tableName.column_name} WHERE ${tableName.column_name}_id = $1`,
        values: [entry[tableName.column_name]],
      };
      let { code, rows } = await performQuery(client, query);
      if (code !== 200) {
        throw new Error("Couldn't get the details for a client.");
      }
      tableValues = rows[0];
    }

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
      let value =
        Object.keys(tableValues).length > 0
          ? tableValues[field.column_name]
          : field.data_type === "USER-DEFINED"
          ? "---"
          : field.data_type === "boolean"
          ? false
          : "";
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
          options = await getEnumTypeValues(client, field.udt_name);
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

  client.end();

  return {
    id: entry.id,
    tabs: clientDetailsTabs,
  };
};

export const getClientDetails = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;

  // Get all column names other than the id field.
  let tableNames;
  try {
    tableNames = await getTableSchema(client, "clients");
  } catch (e: any) {
    res.status(400);
    res.write(JSON.stringify({ message: e.message }));
    next();
    return;
  }
  tableNames = tableNames.slice(1);

  // Get all the entries in the clients database.
  let query: QueryProps = {
    name: "getClientEntries",
    text: "SELECT * from clients;",
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({ message: "The clients entries couldn't be fetched." })
    );
    next();
    return;
  }

  let clientEntries = rows;

  let promises: Promise<ClientDetails>[] = [];
  for (let entry of clientEntries) {
    let clientDetailsPromise = getSingleClientDetails(entry, tableNames);
    promises.push(clientDetailsPromise);
  }

  let clientDetails = await Promise.all(promises);

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

  // Get all column names other than the id field.
  let tableNames = await getTableSchema(client, "clients");
  try {
    tableNames = tableNames.slice(1);
  } catch (e: any) {
    res.status(400);
    res.write(JSON.stringify({ message: e.message }));
    next();
    return;
  }

  const clientDetailsSchema: ClientDetailsTab[] = [];

  // Get the schema for each table related to clients.
  for (let tableName of tableNames) {
    let rows;
    try {
      rows = await getTableSchema(client, tableName.column_name);
    } catch (e: any) {
      res.status(400);
      res.write(JSON.stringify(JSON.stringify({ message: e.message })));
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
          try {
            options = await getEnumTypeValues(client, field.udt_name);
          } catch (e: any) {
            res.status(400);
            res.write(JSON.stringify({ message: e.message }));
            next();
            return;
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

  res.status(200);
  res.write(JSON.stringify(clientDetails));
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
        fieldData.required &&
        (fieldData.value === "" || fieldData.value === "---")
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

export const updateClientDetails = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  const clientDetails = req.body.clientDetails;

  let query: QueryProps = {
    name: "getClientEntry",
    text: "SELECT * FROM clients WHERE id=$1;",
    values: [clientDetails.id],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(JSON.stringify({ message: "Failed to get client entries." }));
    next();
    return;
  }
  let entries = rows[0];

  for (let tabData of clientDetails.tabs) {
    // Get the list of column names and values to insert.
    let updateString = "";
    let updateIndex = 1;
    let insertNames: string = `${tabData.name}_id, `;
    let valuePlaceholders: string = "$1, ";
    let values: (string | boolean)[] = [];
    let insertIndex = 2;
    for (let fieldData of tabData.fields) {
      if (
        fieldData.required &&
        (fieldData.value === "" || fieldData.value === "---")
      ) {
        res.status(400);
        res.write(
          JSON.stringify({
            message: `The required parameter ${fieldData.label} was not set`,
          })
        );
        next();
        return;
      }

      updateString += fieldData.name + " = $" + updateIndex + ", ";
      insertNames += fieldData.name + ", ";
      valuePlaceholders += `$${insertIndex}, `;
      insertIndex++;
      updateIndex++;
      values.push(
        fieldData.value === "---" ? fieldData.options[1] : fieldData.value
      );
    }

    updateString = updateString.substring(0, updateString.length - 2);
    insertNames = insertNames.substring(0, insertNames.length - 2);
    valuePlaceholders = valuePlaceholders.substring(
      0,
      valuePlaceholders.length - 2
    );

    if (entries[tabData.name]) {
      // Update the existing values.
      let query: QueryProps = {
        name: `update${tabData.name}Entry`,
        text: `UPDATE ${tabData.name} SET ${updateString} WHERE ${
          tabData.name
        }_id = '${entries[tabData.name]}';`,
        values: values,
      };
      let { code, rows } = await performQuery(client, query);
      if (code !== 200) {
        res.status(400);
        res.write(
          JSON.stringify({
            message: `Failed to update values for ${tabData.name}`,
          })
        );
        next();
        return;
      }
    } else {
      // Create a new id for the entry.
      let entryId = uuidv4();
      values.splice(0, 0, entryId);

      let query: QueryProps = {
        name: `insert${tabData.name}Entry`,
        text: `INSERT INTO ${tabData.name} (${insertNames}) VALUES (${valuePlaceholders});`,
        values: values,
      };
      let { code, rows } = await performQuery(client, query);
      if (code !== 200) {
        res.status(400);
        res.write(
          JSON.stringify({ message: `Unable to insert into ${tabData.name}.` })
        );
        next();
        return;
      }

      query = {
        name: `insert${tabData.name}ToClients`,
        text: `UPDATE clients SET ${tabData.name} = '${entryId}' WHERE id = '${clientDetails.id}';`,
        values: [],
      };
      ({ code, rows } = await performQuery(client, query));
      if (code !== 200) {
        deleteInsertedEntries(client, [
          { tableName: tabData.Name, id: entryId },
        ]);
        res.status(400);
        res.write(
          JSON.stringify({
            message: `Couldn't relate ${tabData.name} entry to clients.`,
          })
        );
        next();
        return;
      }
    }
  }

  res.status(200);
  next();
};

export const getAllTabs = async (req: Request, res: Response, next: any) => {
  const client = req.body.awsClient;

  // Get all column names other than the id field.
  let tableNames = await getTableSchema(client, "clients");
  tableNames = tableNames.slice(1);
  let tabNames = tableNames.map((name) => capitalizeName(name.column_name));

  res.status(200);
  res.write(JSON.stringify({ tabs: tabNames }));
  next();
};

export const createTab = async (req: Request, res: Response, next: any) => {
  const client = req.body.awsClient;
  const tabName = createColumnName(req.body.tabName);
  const tabNameKey = `${tabName}_id`;

  // Create a new database table for the tabs.
  let query: QueryProps = {
    name: "createTabQuery",
    text: `CREATE TABLE ${tabName} (${tabNameKey} VARCHAR(36) PRIMARY KEY);`,
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(JSON.stringify({ message: `Could not create tab ${tabName}.` }));
    next();
    return;
  }

  query = {
    name: "AddTabColumn",
    text: `ALTER TABLE clients ADD COLUMN ${tabName} VARCHAR(36) CONSTRAINT clients_${tabName}_fk_${tabNameKey} REFERENCES ${tabName} (${tabNameKey});`,
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Could not add the tab ${tabName} to clients.`,
      })
    );
    next();
    return;
  }

  res.status(200);
  next();
};

export const updateTabName = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  const currentName = req.body.currentName;
  const newName = req.body.newName;

  let query: QueryProps = {
    name: "renameColumn",
    text: `ALTER TABLE ${currentName} RENAME TO ${newName};`,
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Failed to rename table ${currentName} to ${newName}`,
      })
    );
    next();
    return;
  }

  // ALTER TABLE ${newName} RENAME CONSTRAINT ${currentName}_pkey TO ${newName}_pkey;
  query = {
    name: "renameColumnPrimaryKey",
    text: `ALTER TABLE ${newName} RENAME CONSTRAINT ${currentName}_pkey TO ${newName}_pkey;`,
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Failed to rename table ${newName} constraint`,
      })
    );
    next();
    return;
  }

  // ALTER TABLE ${newName} RENAME COLUMN ${currentName)_id TO ${newName}_id;
  query = {
    name: "renameColumnName",
    text: `ALTER TABLE ${newName} RENAME COLUMN ${currentName}_id TO ${newName}_id;`,
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Failed to update column name ${currentName}_id in table ${newName}`,
      })
    );
    next();
    return;
  }

  // ALTER TABLE clients RENAME COLUMN ${currentName} TO ${newName};
  query = {
    name: "renameClientsColumn",
    text: `ALTER TABLE clients RENAME COLUMN ${currentName} TO ${newName};`,
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Failed to rename column ${currentName} in clients;`,
      })
    );
    next();
    return;
  }

  res.status(200);
  next();
};

export const deleteTab = async (req: Request, res: Response, next: any) => {
  const client = req.body.awsClient;
  const tabName = createColumnName(req.body.tabName);

  let query: QueryProps = {
    name: "removeClientColumn",
    text: `ALTER TABLE clients DROP COLUMN ${tabName};`,
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Failed to delete column ${tabName} from clients.`,
      })
    );
    next();
    return;
  }

  query = {
    name: "dropTabTable",
    text: `DROP TABLE ${tabName};`,
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code !== 200) {
    res.status(400);
    res.write(JSON.stringify({ message: `Failed to drop table ${tabName}` }));
    next();
    return;
  }

  res.status(200);
  next();
};

export const getAllFields = async (req: Request, res: Response, next: any) => {
  const client = req.body.awsClient;

  let tableNames = await getTableSchema(client, "clients");
  // Get all column names other than the id field.
  tableNames = tableNames.slice(1) as ColumnSchemaInfo[];
  let allFieldNames: string[] = [];

  for (let tableName of tableNames) {
    let fieldNames = await getTableSchema(client, tableName.column_name);
    fieldNames = fieldNames.slice(1) as ColumnSchemaInfo[];
    allFieldNames = allFieldNames.concat(
      fieldNames.map((name) => capitalizeName(name.column_name))
    );
  }

  res.status(200);
  res.write(JSON.stringify({ fields: allFieldNames }));
  next();
};

export const getFieldsForTab = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  const tabName = createColumnName(req.query.tabName as string);

  let fieldNames = await getTableSchema(client, tabName);
  fieldNames = fieldNames.slice(1) as ColumnSchemaInfo[];
  const fieldStringNames = fieldNames.map((name) =>
    capitalizeName(name.column_name)
  );

  res.status(200);
  res.write(JSON.stringify({ fieldNames: fieldStringNames }));
  next();
};

export const getFieldSchema = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  const tabName = createColumnName(req.query.tabName as string);
  const fieldName = createColumnName(req.query.fieldName as string);

  let rows;
  try {
    rows = await getTableSchema(client, tabName);
  } catch (e: any) {
    res.status(400);
    res.write(JSON.stringify({ message: e.message }));
    next();
    return;
  }

  let field = rows.filter((data) => data.column_name === fieldName)[0];

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
      let query = {
        name: `get${field.udt_name}Values`,
        text: `SELECT unnest(enum_range(null::${field.udt_name}));`,
        values: [],
      };
      let { code, rows } = await performQuery(client, query);
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

  res.status(200);
  res.write(JSON.stringify({ fieldSchema: fieldSchema }));
  next();
};

export const createField = async (req: Request, res: Response, next: any) => {
  const client = req.body.awsClient;
  const tabName = req.body.tabName.toLowerCase() as string;
  const fieldData = req.body.fieldData as DatabaseColumn;

  if (isNullOrWhiteSpace(tabName)) {
    res.status(400);
    res.write(
      JSON.stringify({ message: "You must provide a tab to add to." })
    );
  }

  if (isNullOrWhiteSpace(fieldData.name)) {
    res.status(400);
    res.write(JSON.stringify({ message: "You must provide a field name." }));
    next();
    return;
  }

  if (fieldData.type === "select" && !fieldData.options) {
    res.status(400);
    res.write(
      JSON.stringify({ message: "You must provide values for a dropdown." })
    );
    next();
    return;
  }

  const tabId = createColumnName(tabName);
  const fieldName = createColumnName(fieldData.name);

  let enumName: string = "";
  if (fieldData.type === "select" && fieldData.options) {
    enumName = capitalize(fieldName);
    let createEnumQuery = `CREATE TYPE ${enumName} AS ENUM (${fieldData.options?.map(
      (val) => "'" + val + "'"
    )});`;

    let enumQuery: QueryProps = {
      name: `create${enumName}Query`,
      text: createEnumQuery,
      values: [],
    };
    let { code, rows } = await performQuery(client, enumQuery);
    if (code !== 200) {
      res.status(400);
      res.write(
        JSON.stringify({ message: `Failed to create the enum ${enumName}` })
      );
      next();
      return;
    }
  }

  let fieldType: string = "";
  let defaultValue: string | boolean;
  switch (fieldData.type) {
    case "text":
      fieldType = "VARCHAR(200)";
      defaultValue = "N/A";
      break;
    case "checkbox":
      fieldType = "BOOLEAN";
      defaultValue = false;
      break;
    case "select":
      fieldType = enumName;
      defaultValue = fieldData.options ? fieldData.options[0] : "";
      break;
    default:
      fieldType = "TEXT";
      defaultValue = "N/A";
      break;
  }

  let requiredField = fieldData.required
    ? `NOT NULL DEFAULT '${defaultValue}'`
    : `DEFAULT '${defaultValue}'`;
  let queryText = `ALTER TABLE ${tabId} ADD COLUMN ${fieldName} ${fieldType} ${requiredField};`;

  let query: QueryProps = {
    name: `add${fieldName}Column`,
    text: queryText,
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Failed to add the field ${fieldData.name} to tab ${tabName}`,
      })
    );
    next();
    return;
  }

  res.status(200);
  next();
};

export const updateField = (req: Request, res: Response, next: any) => {
  const client = req.body.awsClient;
  const tabName = req.body.tabName;
  const fieldName = req.body.fieldName;
  const fieldValues = req.body.fieldValues;

  res.status(400);
  next();
};

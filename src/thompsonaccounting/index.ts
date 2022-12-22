import { Request, Response } from "express";
import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
  QueryProps,
  performQuery,
  performFormattedQuery,
} from "../utils/database";
import { capitalize, isNullOrWhiteSpace } from "../utils/string";
import {
  capitalizeName,
  createTabName,
  createFieldName,
  getClientSchema,
  getEnumTypeValues,
  getTableSchema,
  computeFieldHash,
  removeFieldHash,
} from "./helpers";
import {
  ClientDetails,
  DatabaseColumn,
  ColumnType,
  IsNullable,
  InsertedEntry,
  ColumnSchemaInfo,
} from "./types";

const format = require("pg-format");

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

  let schema = await getClientSchema(client);

  if (schema === undefined) {
    res.status(400);
    res.write(JSON.stringify({ message: "Failed to get client schema. " }));
    next();
    return;
  }

  let tableNames = schema.tabs.map((tab) => tab.name);

  let selectConditions: string[] = ["clients.*"];
  let joinConditions: string[] = [];
  // Get the schema for each table related to clients.

  for (let i = 0; i < tableNames.length; i++) {
    let table = tableNames[i];
    selectConditions.push(`${table}.*`);
    joinConditions.push(
      `LEFT JOIN ${table} ON clients.${table} = ${table}.${table}_id`
    );
  }

  let selectString = selectConditions.join(", ");
  let joinString = joinConditions.join(" ");

  let sql = `SELECT ${selectString} FROM clients ${joinString};`;

  let { code, rows } = await performFormattedQuery(client, sql);
  if (code !== 200 || rows.length === 0) {
    res.status(400);
    res.write(JSON.stringify({ message: "Failed to get clients." }));
    next();
    return;
  }

  let allClientDetails: ClientDetails[] = [];
  // Need to use the client schema to parse all of the returned rows.
  for (let details of rows) {
    // Create a deep copy of the schema tabs.
    let clientDetails: ClientDetails = {
      id: details.id,
      tabs: JSON.parse(JSON.stringify(schema.tabs)),
    };

    for (let i = 0; i < schema.tabs.length; i++) {
      for (let j = 0; j < schema.tabs[i].fields.length; j++) {
        clientDetails.tabs[i].fields[j].value =
          details[
            computeFieldHash(
              schema.tabs[i].name,
              schema.tabs[i].fields[j].name
            )
          ];
      }
    }

    let copy = { ...clientDetails };

    allClientDetails.push(copy);
  }

  res.status(200);
  res.write(JSON.stringify(allClientDetails));
  next();
};

export const getNewClientSchema = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;

  let schema = await getClientSchema(client);

  if (schema === undefined) {
    res.status(400);
    res.write(JSON.stringify({ message: "Failed to get client details." }));
    next();
    return;
  }

  res.status(200);
  res.write(JSON.stringify(schema));
  next();
};

export const postNewClientDetails = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.awsClient;
  const newClient = req.body.formData as ClientDetails;

  // Validate all required parameters are set.
  for (let tab of newClient.tabs) {
    for (let field of tab.fields) {
      if (field.required && (field.value === "" || field.value === "---")) {
        res.status(400);
        res.write(
          JSON.stringify({
            message: `The required parameter ${field.label} was not entered.`,
          })
        );
        next();
        return;
      }
    }
  }

  const insertedEntries: InsertedEntry[] = [];

  let foreignNames: string[] = ["id"];
  let foreignKeys: string[] = [uuidv4()];
  let foreignPlaceholders: string[] = ["$1"];
  let foreignIndex = 2;

  // Write an entry to each auxiliary table.
  for (let tabData of newClient.tabs) {
    foreignPlaceholders.push(`$${foreignIndex}`);
    foreignIndex++;
    // Get the list of column names and values to insert.
    let insertNames: string = `${tabData.name}_id, `;
    let valuePlaceholders: string = "$1, ";
    let values: (string | boolean)[] = [];
    let index = 2;
    for (let fieldData of tabData.fields) {
      insertNames += computeFieldHash(tabData.name, fieldData.name) + ", ";
      valuePlaceholders += `$${index}, `;
      index++;
      values.push(
        fieldData.value === "---"
          ? fieldData.options
            ? fieldData.options[1]
            : ""
          : fieldData.value
      );
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
  const clientDetails = req.body.clientDetails as ClientDetails;

  // Validate all required parameters are set.
  for (let tab of clientDetails.tabs) {
    for (let field of tab.fields) {
      if (field.required && (field.value === "" || field.value === "---")) {
        res.status(400);
        res.write(
          JSON.stringify({
            message: `The required parameter ${field.label} was not entered.`,
          })
        );
        next();
        return;
      }
    }
  }

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
  console.log(entries);

  for (let tabData of clientDetails.tabs) {
    // Get the list of column names and values to insert.
    let updateString = "";
    let updateIndex = 1;
    let insertNames: string = `${tabData.name}_id, `;
    let valuePlaceholders: string = "$1, ";
    let values: (string | boolean)[] = [];
    let insertIndex = 2;
    for (let fieldData of tabData.fields) {
      updateString +=
        computeFieldHash(tabData.name, fieldData.name) +
        " = $" +
        updateIndex +
        ", ";
      insertNames += computeFieldHash(tabData.name, fieldData.name) + ", ";
      valuePlaceholders += `$${insertIndex}, `;
      insertIndex++;
      updateIndex++;
      values.push(
        fieldData.value === "---" && fieldData.options
          ? fieldData.options[1]
          : fieldData.value
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
          { tableName: tabData.name, id: entryId },
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
  const tabName = createTabName(req.body.tabName);
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
  const currentName = createTabName(req.body.currentName);
  const newName = createTabName(req.body.newName);

  let sql = format("ALTER TABLE %I RENAME TO %s;", currentName, newName);
  let { code, rows } = await performFormattedQuery(client, sql);
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
  let sqlString = `ALTER TABLE %I RENAME CONSTRAINT ${currentName}_PKEY TO ${newName}_pkey;`;
  sql = format(sqlString, newName);
  ({ code, rows } = await performFormattedQuery(client, sql));
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
  sqlString = `ALTER TABLE %I RENAME COLUMN ${currentName}_id TO ${newName}_id;`;
  sql = format(sqlString, newName);
  ({ code, rows } = await performQuery(client, sql));
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
  sqlString = `ALTER TABLE clients RENAME COLUMN %s TO %s;`;
  sql = format(sqlString, currentName, newName);
  ({ code, rows } = await performQuery(client, sql));
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
  const tabName = createTabName(req.body.tabName);

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
  const tabName = createTabName(req.query.tabName as string);

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
  const tabName = createTabName(req.query.tabName as string);
  let fieldName = createTabName(req.query.fieldName as string);

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

      options = await getEnumTypeValues(client, field.udt_name);
      if (options !== undefined && options[0] !== "---") {
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

  const tabId = createTabName(tabName);
  const fieldName = createFieldName(tabId, fieldData.name);

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

export const updateField = async (req: Request, res: Response, next: any) => {
  const client: Client = req.body.awsClient;
  const tabName: string = createTabName(req.body.tabName);
  const fieldName: string = createFieldName(tabName, req.body.fieldName);
  const fieldValues: DatabaseColumn = req.body.fieldValues;

  const newFieldName = createFieldName(tabName, fieldValues.label);

  let query: QueryProps;
  // Update name and enum name if there was a change
  if (fieldName !== newFieldName) {
    // Update the field name.
    let query: QueryProps = {
      name: `update${fieldName}Name`,
      text: `ALTER TABLE ${tabName} RENAME COLUMN ${fieldName} TO ${newFieldName};`,
      values: [],
    };
    let { code, rows } = await performQuery(client, query);
    if (code !== 200) {
      res.status(400);
      res.write(
        JSON.stringify({
          message: `Failed to rename the column ${fieldName}.`,
        })
      );
      next();
      return;
    }
  }

  // update the required status of the column.
  if (fieldValues.required) {
    query = {
      name: `set${newFieldName}Required`,
      text: `ALTER TABLE ${tabName} ALTER COLUMN ${newFieldName} SET NOT NULL`,
      values: [],
    };
  } else {
    query = {
      name: `set ${newFieldName}Required`,
      text: `ALTER TABLE ${tabName} ALTER COLUMN ${newFieldName} DROP NOT NULL`,
      values: [],
    };
  }

  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: `Failed to update required status for column ${newFieldName}`,
      })
    );
    next();
    return;
  }

  // If it is a dropdown, update the values if any have changed.
  // ALTER TYPE enumName ADD VALUE 'newVal' AFTER 'oldVal';
  if (fieldValues.type === "select") {
    if (fieldName !== newFieldName) {
      let query: QueryProps = {
        name: `update${fieldName}Type`,
        text: `ALTER TYPE ${fieldName} RENAME TO ${newFieldName};`,
        values: [],
      };
      let { code, rows } = await performQuery(client, query);
      if (code !== 200) {
        res.status(400);
        res.write(
          JSON.stringify({ message: `Failed to rename the enum ${fieldName}` })
        );
        next();
        return;
      }
    }

    // Get the possible values for the user defined enum.
    query = {
      name: `get${newFieldName}Values`,
      text: `SELECT unnest(enum_range(null::${newFieldName}));`,
      values: [],
    };
    ({ code, rows } = await performQuery(client, query));
    if (code !== 200) {
      res.status(404);
      res.write(
        JSON.stringify({ message: "User defined enum not found in database." })
      );
      next();
      return;
    }

    let options = rows.map((row) => row.unnest);

    // If there are no values or no new values, don't do anything.
    if (!fieldValues.options || options.length >= fieldValues.options.length) {
      res.status(200);
      next();
      return;
    }

    fieldValues.options.splice(0, 1);

    for (let i = options.length; i < fieldValues.options.length; i++) {
      // for each element fieldValues.options.length[i] add it to the enum list after the last value.
      var sql = format(
        "ALTER TYPE %I ADD VALUE '%s' AFTER '%s';",
        newFieldName,
        fieldValues.options[i],
        fieldValues.options[i - 1]
      );
      ({ code, rows } = await performFormattedQuery(client, sql));
      if (code !== 200) {
        res.status(400);
        res.write(
          JSON.stringify({
            message: `Couldn't add the value ${fieldValues.options[i]} to the enum ${newFieldName}`,
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

export const deleteField = async (req: Request, res: Response, next: any) => {
  const client = req.body.awsClient;

  const tabName = createTabName(req.body.tabName);
  const fieldName = createFieldName(tabName, req.body.fieldName);

  let query: QueryProps = {
    name: `drop${fieldName}Column`,
    text: `ALTER TABLE ${tabName} DROP COLUMN ${fieldName};`,
    values: [],
  };
  const { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({ message: `Failed to delete the field ${fieldName}` })
    );
    next();
    return;
  }

  res.status(200);
  next();
};

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, DatabaseConnection } from "../utils/database";
import {
  ErrorStatusCode,
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../utils/response";
import { capitalize, isNullOrWhiteSpace } from "../utils/string";
import {
  capitalizeName,
  createTabName,
  createFieldName,
  getClientSchema,
  getEnumTypeValues,
  getTableSchema,
  getFieldMetadata,
  getFieldMetadataForTab,
  getNumberOfFields,
} from "./helpers";
import {
  ClientDetails,
  DatabaseColumn,
  ColumnType,
  IsNullable,
  InsertedEntry,
  FieldMetadata,
} from "./types";

const format = require("pg-format");

export const getClientDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;

  let schema = await getClientSchema(client.GetClient());

  if (schema === undefined) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "Failed to get client schema."
    );
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

  let rows = await client.PerformFormattedQuery(sql);
  if (rows.length === 0) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "Failed to get clients."
    );
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
            createFieldName(schema.tabs[i].name, schema.tabs[i].fields[j].name)
          ];
      }
    }

    let copy = { ...clientDetails };

    allClientDetails.push(copy);
  }

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, allClientDetails);
};

export const getNewClientSchema = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;

  let schema = await getClientSchema(client.GetClient());

  if (schema === undefined) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "Failed to get client details."
    );
  }

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, schema);
};

export const postNewClientDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const newClient = req.body.formData as ClientDetails;

  // Validate all required parameters are set.
  for (let tab of newClient.tabs) {
    for (let field of tab.fields) {
      if (field.required && (field.value === "" || field.value === "---")) {
        return responseHelper.ErrorResponse(
          ErrorStatusCode.BadRequest,
          `The required parameter ${field.label} was not entered.`
        );
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
      insertNames += createFieldName(tabData.name, fieldData.name) + ", ";
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
    await client.PerformQuery(query);

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
  await client.PerformQuery(query);

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const updateClientDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const clientDetails = req.body.clientDetails as ClientDetails;

  // Validate all required parameters are set.
  for (let tab of clientDetails.tabs) {
    for (let field of tab.fields) {
      if (field.required && (field.value === "" || field.value === "---")) {
        return responseHelper.ErrorResponse(
          ErrorStatusCode.BadRequest,
          `The required parameter ${field.label} was not entered.`
        );
      }
    }
  }

  let query: QueryProps = {
    name: "getClientEntry",
    text: "SELECT * FROM clients WHERE id=$1;",
    values: [clientDetails.id],
  };
  let rows = await client.PerformQuery(query);
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
      updateString +=
        createFieldName(tabData.name, fieldData.name) +
        " = $" +
        updateIndex +
        ", ";
      insertNames += createFieldName(tabData.name, fieldData.name) + ", ";
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

    if (
      entries[tabData.name] &&
      !isNullOrWhiteSpace(updateString) &&
      !isNullOrWhiteSpace(insertNames) &&
      !isNullOrWhiteSpace(valuePlaceholders)
    ) {
      // Update the existing values.
      let query: QueryProps = {
        name: `update${tabData.name}Entry`,
        text: `UPDATE ${tabData.name} SET ${updateString} WHERE ${
          tabData.name
        }_id = '${entries[tabData.name]}';`,
        values: values,
      };
      await client.PerformQuery(query);
    } else {
      // Create a new id for the entry.
      let entryId = uuidv4();
      values.splice(0, 0, entryId);

      let query: QueryProps = {
        name: `insert${tabData.name}Entry`,
        text: `INSERT INTO ${tabData.name} (${insertNames}) VALUES (${valuePlaceholders});`,
        values: values,
      };
      await client.PerformQuery(query);

      query = {
        name: `insert${tabData.name}ToClients`,
        text: `UPDATE clients SET ${tabData.name} = '${entryId}' WHERE id = '${clientDetails.id}';`,
        values: [],
      };
      await client.PerformQuery(query);
    }
  }

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const deleteClient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const clientId = req.body.clientId;

  let query: QueryProps = {
    name: "GetClientTableIds",
    text: "SELECT * FROM clients WHERE id=$1",
    values: [clientId],
  };
  let tableNames = await client.PerformQuery(query);
  if (tableNames.length === 0) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "Failed to get the client's details."
    );
  }

  query = {
    name: "DeleteFromClients",
    text: "DELETE FROM clients WHERE id=$1 RETURNING *;",
    values: [clientId],
  };
  await client.PerformQuery(query);

  for (const [tableName, id] of Object.entries(tableNames[0])) {
    if (tableName === "id") {
      continue;
    }

    let sqlString = `DELETE FROM %I WHERE ${tableName}_id='%s' RETURNING *;`;
    let sql = format(sqlString, tableName, id);
    await client.PerformFormattedQuery(sql);
  }

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const getAllTabs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;

  // Get all column names other than the id field.
  let tableNames = await getTableSchema(client.GetClient(), "clients");
  let tabNames = tableNames.map((name) => capitalizeName(name.column_name));

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    tabs: tabNames,
  });
};

export const createTab = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const tabName = createTabName(req.body.tabName);
  const tabNameKey = `${tabName}_id`;

  // Create a new database table for the tabs.
  let query: QueryProps = {
    name: "createTabQuery",
    text: `CREATE TABLE ${tabName} (${tabNameKey} VARCHAR(36) PRIMARY KEY);`,
    values: [],
  };
  await client.PerformQuery(query);

  query = {
    name: "AddTabColumn",
    text: `ALTER TABLE clients ADD COLUMN ${tabName} VARCHAR(36) CONSTRAINT clients_${tabName}_fk_${tabNameKey} REFERENCES ${tabName} (${tabNameKey});`,
    values: [],
  };
  await client.PerformQuery(query);

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const updateTabName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const currentName = createTabName(req.body.currentName);
  const newName = createTabName(req.body.newName);

  let sql = format("ALTER TABLE %I RENAME TO %s;", currentName, newName);
  await client.PerformFormattedQuery(sql);

  // ALTER TABLE ${newName} RENAME CONSTRAINT ${currentName}_pkey TO ${newName}_pkey;
  let sqlString = `ALTER TABLE %I RENAME CONSTRAINT ${currentName}_PKEY TO ${newName}_pkey;`;
  sql = format(sqlString, newName);
  await client.PerformFormattedQuery(sql);

  // ALTER TABLE ${newName} RENAME COLUMN ${currentName)_id TO ${newName}_id;
  sqlString = `ALTER TABLE %I RENAME COLUMN ${currentName}_id TO ${newName}_id;`;
  sql = format(sqlString, newName);
  await client.PerformFormattedQuery(sql);

  // ALTER TABLE clients RENAME COLUMN ${currentName} TO ${newName};
  sqlString = `ALTER TABLE clients RENAME COLUMN %s TO %s;`;
  sql = format(sqlString, currentName, newName);
  await client.PerformFormattedQuery(sql);

  sqlString =
    "UPDATE field_metadata SET tab_name='%s' WHERE tab_name='%s' RETURNING *;";
  sql = format(sqlString, newName, currentName);
  await client.PerformFormattedQuery(sql);

  // Need to now rename all fields in that table, as their hash will be different now.
  let schema = await getTableSchema(client.GetClient(), newName);

  for (let column of schema) {
    if (column.column_name.endsWith("id")) {
      continue;
    }

    let oldFieldName = createFieldName(currentName, column.column_name);
    let newFieldName = createFieldName(newName, column.column_name);
    sqlString = "ALTER TABLE %I RENAME COLUMN %s TO %s;";
    sql = format(sqlString, newName, oldFieldName, newFieldName);
    await client.PerformFormattedQuery(sql);

    sqlString =
      "UPDATE field_metadata SET field_name='%s' WHERE field_name='%s' RETURNING *;";
    sql = format(sqlString, newFieldName, oldFieldName);
    await client.PerformFormattedQuery(sql);
  }

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const deleteTab = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const tabName = createTabName(req.body.tabName);

  let query: QueryProps = {
    name: "removeClientColumn",
    text: `ALTER TABLE clients DROP COLUMN ${tabName};`,
    values: [],
  };
  await client.PerformQuery(query);

  query = {
    name: "dropTabTable",
    text: `DROP TABLE ${tabName};`,
    values: [],
  };
  await client.PerformQuery(query);

  // Delete all metadata associated with the tab.
  query = {
    name: "deleteTabMetadata",
    text: "DELETE FROM field_metadata WHERE tab_name=$1;",
    values: [tabName],
  };
  await client.PerformQuery(query);

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const getAllFields = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;

  let tableNames = await getTableSchema(client.GetClient(), "clients");
  let allFieldNames: string[] = [];

  for (let tableName of tableNames) {
    let fieldNames = await getTableSchema(
      client.GetClient(),
      tableName.column_name
    );
    allFieldNames = allFieldNames.concat(
      fieldNames.map((name) => capitalizeName(name.column_name))
    );
  }

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    fields: allFieldNames,
  });
};

export const getFieldsForTab = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const tabName = createTabName(req.query.tabName as string);

  let fieldNames = await getTableSchema(client.GetClient(), tabName);
  const fieldStringNames = fieldNames.map((name) =>
    capitalizeName(name.column_name)
  );

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    fieldNames: fieldStringNames,
  });
};

export const getFieldSchema = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const tabName = createTabName(req.query.tabName as string);
  let fieldName = createTabName(req.query.fieldName as string);

  let rows;
  try {
    rows = await getTableSchema(client.GetClient(), tabName);
  } catch (e: any) {
    return responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, e.message);
  }

  let metadata;
  try {
    metadata = await getFieldMetadata(
      client.GetClient(),
      createFieldName(tabName, fieldName)
    );
  } catch (e: any) {
    return responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, e.message);
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

      options = await getEnumTypeValues(client.GetClient(), field.udt_name);
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
    position: metadata.position,
    options: options,
  };

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    fieldSchema: fieldSchema,
  });
};

export const getFieldsMetadata = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.resopnse as ResponseHelper;
  const tabName = createTabName(req.query.tabName as string);

  let metadata: FieldMetadata[] = [];
  try {
    metadata = await getFieldMetadataForTab(client.GetClient(), tabName);
  } catch (e: any) {
    return responseHelper.SuccessfulResponse(
      SuccessfulStatusCode.Ok,
      e.message
    );
  }

  metadata = metadata.map((data) => {
    return {
      tab_name: data.tab_name,
      field_name: capitalizeName(data.field_name),
      position: data.position,
    };
  });

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, metadata);
};

export const reorderFields = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const fieldMetadata = req.body.fieldMetadata as FieldMetadata[];

  for (let metadata of fieldMetadata) {
    let fieldName = createFieldName(
      metadata.tab_name,
      createTabName(metadata.field_name)
    );
    let query: QueryProps = {
      name: "UpdateFieldMetadata",
      text: "UPDATE field_metadata SET position = $1 WHERE tab_name=$2 AND field_name=$3 RETURNING *;",
      values: [metadata.position, metadata.tab_name, fieldName],
    };
    await client.PerformQuery(query);
  }

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const createField = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const tabName = req.body.tabName.toLowerCase() as string;
  const fieldData = req.body.fieldData as DatabaseColumn;

  if (isNullOrWhiteSpace(tabName)) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "You must provide a tab to add to."
    );
  }

  if (isNullOrWhiteSpace(fieldData.name)) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "You must provide a field name."
    );
  }

  if (fieldData.type === "select" && !fieldData.options) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "You must provide values for a dropdown."
    );
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
    await client.PerformQuery(enumQuery);
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
  await client.PerformQuery(query);

  // Add a column to the field metadata.
  let metadataId = uuidv4();
  // Subtract 2 from the number of fields to account for the ID field and the
  // newly created field.
  let position = (await getNumberOfFields(client.GetClient(), tabId)) - 2;
  query = {
    name: "CreateFieldMetadata",
    text: "INSERT INTO field_metadata (metadata_id, tab_name, field_name, position) VALUES ($1, $2, $3, $4);",
    values: [metadataId, tabId, fieldName, position],
  };
  await client.PerformQuery(query);

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const updateField = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
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
    await client.PerformQuery(query);

    query = {
      name: "UpdateFieldMetadataName",
      text: "UPDATE field_metadata SET field_name = $1 WHERE field_name=$2 RETURNING *;",
      values: [newFieldName, fieldName],
    };
    await client.PerformQuery(query);
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

  await client.PerformQuery(query);

  // If it is a dropdown, update the values if any have changed.
  // ALTER TYPE enumName ADD VALUE 'newVal' AFTER 'oldVal';
  if (fieldValues.type === "select") {
    if (fieldName !== newFieldName) {
      let query: QueryProps = {
        name: `update${fieldName}Type`,
        text: `ALTER TYPE ${fieldName} RENAME TO ${newFieldName};`,
        values: [],
      };
      await client.PerformQuery(query);
    }

    // Get the possible values for the user defined enum.
    query = {
      name: `get${newFieldName}Values`,
      text: `SELECT unnest(enum_range(null::${newFieldName}));`,
      values: [],
    };
    let enumVals = await client.PerformQuery(query);
    let options = enumVals.map((val) => val.unnest);

    // If there are no values or no new values, don't do anything.
    if (!fieldValues.options || options.length >= fieldValues.options.length) {
      return responseHelper.GenericResponse(HttpStatusCode.Ok);
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
      await client.PerformFormattedQuery(sql);
    }
  }

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const deleteField = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.awsClient as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;

  const tabName = createTabName(req.body.tabName);
  const fieldName = createFieldName(tabName, req.body.fieldName);

  let query: QueryProps = {
    name: `drop${fieldName}Column`,
    text: `ALTER TABLE ${tabName} DROP COLUMN ${fieldName};`,
    values: [],
  };
  await client.PerformQuery(query);

  // Delete the metadata for that field.
  query = {
    name: "deleteFieldMetadata",
    text: "DELETE FROM field_metadata WHERE tab_name=$1 AND field_name=$2;",
    values: [tabName, fieldName],
  };
  await client.PerformQuery(query);

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

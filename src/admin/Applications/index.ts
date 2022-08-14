import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, performQuery } from "../../utils/database";
import { ReturnApp } from "./types";
import { AdminGetResponseData, DefaultValues } from "../../types";

/**
 * Gets a list of all applications in the database.
 * @param req
 * @param res
 * @param next
 */
export const getApplications = async (
  req: Request,
  res: Response,
  next: any
) => {
  // Get template for all of the data that will be required.
  let responseData: AdminGetResponseData = {
    elements: [],
    headers: [],
    editableFields: [],
    newFields: [],
    defaultValues: [],
  };
  // Get list of the application fields.
  const client = req.body.client;
  let query: QueryProps = {
    name: "applicationGetQuery",
    text: "SELECT applicationid, applicationname, redirecturl FROM applications;",
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code === 200) {
    responseData.elements = rows;
  }

  let allHeaders = [
    { text: "Application ID", field: "applicationid", type: "text" },
    { text: "Application Name", field: "applicationname", type: "text" },
    { text: "Redirect URL", field: "redirecturl", type: "text" },
  ];
  // Fields to display in the table.
  responseData.headers = [
    { text: "Application ID", field: "applicationid" },
    { text: "Application Name", field: "applicationname" },
    { text: "Redirect URL", field: "redirecturl" },
  ];
  // Fields to display when editing an element.
  responseData.editableFields = [
    { text: "Application ID", field: "applicationid", edit: false },
    { text: "Application Name", field: "applicationname", edit: true },
    { text: "Redirect URL", field: "redirecturl", edit: true },
  ];
  // Fields to display when creating a new element.
  responseData.newFields = [
    { text: "Application Name", field: "applicationname" },
    { text: "Redirect URL", field: "redirecturl" },
  ];

  // Set default values for all headers and make them all not editable by
  // default.
  allHeaders.map((header) => {
    responseData.defaultValues.push({
      id: header.field,
      value: "",
      label: header.text,
      component: header.type,
      editable: false,
    });
  });

  res.status(200).write(JSON.stringify(responseData));
};

/**
 * Creates a new application entry.
 * @param req The Express request object. Requires the new application fields
 *    as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const createApplication = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  const newElement = req.body.newElement as DefaultValues[];

  // Generate a new application id.
  const newAppId = uuidv4();

  // Construct the query to create the application.
  let query: QueryProps = {
    name: "appInsertQuery",
    text: "INSERT INTO applications (applicationid, applicationname, redirecturl) VALUES ($1, $2, $3);",
    values: [
      newAppId,
      newElement[1].value.toString(),
      newElement[2].value.toString(),
    ],
  };
  const { code, rows } = await performQuery(client, query);

  // Send appropriate data back to front end.
  if (code === 200) {
    let newApp: ReturnApp = {
      applicationid: newAppId,
      applicationname: newElement[1].value.toString(),
      redirecturl: newElement[2].value.toString(),
    };
    res.status(200).write(JSON.stringify({ newElement: newApp }));
  } else {
    res
      .status(500)
      .write(JSON.stringify({ message: "Failed to create the application." }));
  }
};

/**
 * Update an application's fields.
 * @param req The Express request object. Requires the application fields as
 *    payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const updateApplication = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var updateElement = req.body.updateElement as DefaultValues[];

  // Construct the query to update the application.
  let query: QueryProps = {
    name: "appUpdateQuery",
    text: "UPDATE applications SET applicationname=$1, redirecturl=$2 WHERE applicationid=$3",
    values: [
      updateElement[1].value.toString(),
      updateElement[2].value.toString(),
      updateElement[0].value.toString(),
    ],
  };
  const { code, rows } = await performQuery(client, query);

  // Return the appropriate data.
  if (code === 200) {
    let udpatedApp: ReturnApp = {
      applicationid: updateElement[0].value.toString(),
      applicationname: updateElement[1].value.toString(),
      redirecturl: updateElement[2].value.toString(),
    };
    res.status(200).write(JSON.stringify({ updatedElement: udpatedApp }));
  } else {
    res
      .status(500)
      .write(JSON.stringify({ message: "The application failed to update." }));
  }
};

/**
 * Deletes the given appliation.
 * @param req
 * @param res
 * @param next
 */
export const deleteApplication = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var deleteElement = req.body.deleteElement as DefaultValues[];

  // Construct the query.
  let query: QueryProps = {
    name: "appDeleteQuery",
    text: "DELETE FROM applications WHERE applicationid=$1;",
    values: [deleteElement[0].value.toString()],
  };
  const { code, rows } = await performQuery(client, query);
  // Return the result of the query.
  res.status(code);
};

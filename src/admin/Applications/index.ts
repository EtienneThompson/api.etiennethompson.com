import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, DatabaseConnection } from "../../utils/database";
import { ReturnApp } from "./types";
import { AdminGetResponseData, DefaultValues } from "../../types";
import {
  ErrorStatusCode,
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../../utils/response";

/**
 * Gets a list of all applications in the database.
 * @param req
 * @param res
 * @param next
 */
export const getApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
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
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  let query: QueryProps = {
    name: "applicationGetQuery",
    text: "SELECT applicationid, applicationname, redirecturl FROM applications;",
    values: [],
  };
  let response = await client.PerformQuery(query);
  if (response.code !== 200 || response.rows.length === 0) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "Could not get application."
    );
  }

  responseData.elements = response.rows;

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

  return responseHelper.SuccessfulResponse(
    SuccessfulStatusCode.Ok,
    responseData
  );
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
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const newElement = req.body.newElement as DefaultValues[];

  // Generate a new application id.
  const newAppId = uuidv4();

  // Construct the query to create the application.
  let query: QueryProps = {
    name: "appInsertQuery",
    text: "INSERT INTO applications (applicationid, applicationname, redirecturl) VALUES ($1, $2, $3) RETURNING *;",
    values: [
      newAppId,
      newElement[1].value.toString(),
      newElement[2].value.toString(),
    ],
  };
  const response = await client.PerformQuery(query);

  // Send appropriate data back to front end.
  if (response.code === 200 && response.rows.length !== 0) {
    let newApp: ReturnApp = {
      applicationid: newAppId,
      applicationname: newElement[1].value.toString(),
      redirecturl: newElement[2].value.toString(),
    };
    responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
      newElement: newApp,
    });
  } else {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "Failed to create the application."
    );
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
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  var updateElement = req.body.updateElement as DefaultValues[];

  // Construct the query to update the application.
  let query: QueryProps = {
    name: "appUpdateQuery",
    text: "UPDATE applications SET applicationname=$1, redirecturl=$2 WHERE applicationid=$3 RETURNING *;",
    values: [
      updateElement[1].value.toString(),
      updateElement[2].value.toString(),
      updateElement[0].value.toString(),
    ],
  };
  const response = await client.PerformQuery(query);

  // Return the appropriate data.
  if (response.code === 200 && response.rows.length !== 0) {
    let udpatedApp: ReturnApp = {
      applicationid: updateElement[0].value.toString(),
      applicationname: updateElement[1].value.toString(),
      redirecturl: updateElement[2].value.toString(),
    };
    responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
      updatedElement: udpatedApp,
    });
  } else {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "The application failed to update."
    );
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
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  var deleteElement = req.body.deleteElement as DefaultValues[];

  // Construct the query.
  let query: QueryProps = {
    name: "appDeleteQuery",
    text: "DELETE FROM applications WHERE applicationid=$1;",
    values: [deleteElement[0].value.toString()],
  };
  const response = await client.PerformQuery(query);
  // Return the result of the query.
  responseHelper.GenericResponse(
    response.code === 200 ? HttpStatusCode.Ok : HttpStatusCode.BadRequest
  );
};

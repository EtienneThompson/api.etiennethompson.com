import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, DatabaseConnection } from "../../utils/database";
import { createHourExpiration } from "../../utils/date";
import { AdminGetResponseData, DefaultValues } from "../../types";
import { ReturnUser } from "../types";
import {
  ErrorStatusCode,
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../../utils/response";

/**
 * Gets a list of all relevant user information to display in the admin center.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // These are the fields required by the front end to generically render the
  // admin tables.
  let responseData: AdminGetResponseData = {
    elements: [],
    headers: [],
    editableFields: [],
    newFields: [],
    defaultValues: [],
  };
  // Get the users from the database.
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  let query: QueryProps = {
    name: "userGetQuery",
    text: "SELECT userid, username, email, clientid FROM users;",
    values: [],
  };
  responseData.elements = await client.PerformQuery(query);

  // Every header.
  let allHeaders = [
    { text: "Username", field: "username", type: "text" },
    { text: "Password", field: "password", type: "password" },
    { text: "Email", field: "email", type: "text" },
    { text: "User ID", field: "userid", type: "text" },
    { text: "Client ID", field: "clientid", type: "text" },
  ];
  // Fields to display in the table.
  responseData.headers = [
    { text: "Username", field: "username" },
    { text: "Email", field: "email" },
    { text: "User ID", field: "userid" },
    { text: "Client ID", field: "clientid" },
  ];
  // Fields to display when editing an element.
  responseData.editableFields = [
    { text: "Username", field: "username", edit: true },
    { text: "Email", field: "email", edit: true },
    { text: "User ID", field: "userid", edit: false },
    { text: "Client ID", field: "clientid", edit: false },
  ];
  // Fields to display when creating a new element.
  responseData.newFields = [
    { text: "Username", field: "username" },
    { text: "Password", field: "password" },
    { text: "Email", field: "email" },
  ];

  // Set default values with all fields not able to be edited.
  allHeaders.map((header) => {
    responseData.defaultValues.push({
      id: header.field,
      value: "",
      label: header.text,
      component: header.type,
      editable: false,
    });
  });

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, responseData);
};

/**
 * Create a new user in the database.
 * @param req The Express request object. Requires the new user's fields as
 *    the payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the required data from the request.
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const newElement = req.body.newElement as DefaultValues[];

  // Generate new ids and fields for the user.
  const newUserId = uuidv4();
  const newClientId = uuidv4();
  let expiration = createHourExpiration();

  // Construct the insert query.
  let query: QueryProps = {
    name: "userCreateQuery",
    text: "INSERT INTO users (userid, username, password, clientid, session_expiration, email) VALUES ($1, $2, $3, $4, $5, $6);",
    values: [
      newUserId,
      newElement[0].value.toString(),
      newElement[1].value.toString(),
      newClientId,
      expiration,
      newElement[2].value.toString(),
    ],
  };

  await client.PerformQuery(query);
  let newUser: ReturnUser = {
    userid: newUserId,
    username: newElement[0].value.toString(),
    email: newElement[2].value.toString(),
    clientid: newClientId,
  };
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    newElement: newUser,
  });
};

/**
 * Updates a user's fields in the database.
 * @param req The Express request object, with the new fields as the payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  var updateElement = req.body.updateElement as DefaultValues[];

  let query: QueryProps = {
    name: "userUpdateQuery",
    text: "UPDATE users SET username=$1, email=$2 WHERE userid=$3;",
    values: [
      updateElement[0].value.toString(),
      updateElement[2].value.toString(),
      updateElement[3].value.toString(),
    ],
  };
  await client.PerformQuery(query);
  let updateUser: ReturnUser = {
    userid: updateElement[3].value.toString(),
    username: updateElement[0].value.toString(),
    email: updateElement[2].value.toString(),
    clientid: updateElement[4].value.toString(),
  };
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    updatedElement: updateUser,
  });
};

/**
 * Deletes a user from the database.
 * @param req The Express request object, with the user's fields as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  var deleteElement = req.body.deleteElement as DefaultValues[];

  // Construct delete query.
  let query: QueryProps = {
    name: "userDeleteQuery",
    text: "DELETE FROM users WHERE userid=$1",
    values: [deleteElement[3].value.toString()],
  };
  const response = await client.PerformQuery(query);
  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

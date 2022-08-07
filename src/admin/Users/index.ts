import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, performQuery } from "../../utils/database";
import { createExpiration } from "../../utils/date";
import { AdminGetResponseData, DefaultValues } from "../../types";
import { ReturnUser } from "./types";

/**
 * Gets a list of all relevant user information to display in the admin center.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const getUsers = async (req: Request, res: Response, next: any) => {
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
  const client = req.body.client;
  let query: QueryProps = {
    name: "userGetQuery",
    text: "SELECT userid, username, clientid FROM users;",
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code === 200) {
    responseData.elements = rows;
  }

  // Every header.
  let allHeaders = [
    { text: "Username", field: "username", type: "text" },
    { text: "Password", field: "password", type: "password" },
    { text: "User ID", field: "userid", type: "text" },
    { text: "Client ID", field: "clientid", type: "text" },
  ];
  // Fields to display in the table.
  responseData.headers = [
    { text: "Username", field: "username" },
    { text: "User ID", field: "userid" },
    { text: "Client ID", field: "clientid" },
  ];
  // Fields to display when editing an element.
  responseData.editableFields = [
    { text: "Username", field: "username", edit: true },
    { text: "User ID", field: "userid", edit: false },
    { text: "Client ID", field: "clientid", edit: false },
  ];
  // Fields to display when creating a new element.
  responseData.newFields = [
    { text: "Username", field: "username" },
    { text: "Password", field: "password" },
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

  res.status(200).write(JSON.stringify(responseData));
  next();
};

/**
 * Create a new user in the database.
 * @param req The Express request object. Requires the new user's fields as
 *    the payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const createUser = async (req: Request, res: Response, next: any) => {
  // Get the required data from the request.
  const client = req.body.client;
  const newElement = req.body.newElement as DefaultValues[];

  // Generate new ids and fields for the user.
  const newUserId = uuidv4();
  const newClientId = uuidv4();
  let expiration = createExpiration();

  // Construct the insert query.
  let query: QueryProps = {
    name: "userCreateQuery",
    text: "INSERT INTO users (userid, username, password, clientid, session_expiration) VALUES ($1, $2, $3, $4, $5);",
    values: [
      newUserId,
      newElement[0].value.toString(),
      newElement[1].value.toString(),
      newClientId,
      expiration,
    ],
  };

  const { code, rows } = await performQuery(client, query);

  // Return data to the front end based on response.
  if (code === 200) {
    let newUser: ReturnUser = {
      userid: newUserId,
      username: newElement[0].value.toString(),
      clientid: newClientId,
    };
    res.status(200).write(JSON.stringify({ newElement: newUser }));
  } else {
    res
      .status(500)
      .write(JSON.stringify({ message: "Failed to create user." }));
  }

  next();
};

/**
 * Updates a user's fields in the database.
 * @param req The Express request object, with the new fields as the payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const updateUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  var updateElement = req.body.updateElement as DefaultValues[];

  let query: QueryProps = {
    name: "userUpdateQuery",
    text: "UPDATE users SET username=$1 WHERE userid=$2;",
    values: [
      updateElement[0].value.toString(),
      updateElement[2].value.toString(),
    ],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    let updateUser: ReturnUser = {
      userid: updateElement[2].value.toString(),
      username: updateElement[0].value.toString(),
      clientid: updateElement[3].value.toString(),
    };
    res.status(200).write(JSON.stringify({ updatedElement: updateUser }));
  } else {
    res
      .status(500)
      .write(JSON.stringify({ message: "The user failed to update." }));
  }
  next();
};

/**
 * Deletes a user from the database.
 * @param req The Express request object, with the user's fields as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const deleteUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  var deleteElement = req.body.deleteElement as DefaultValues[];

  // Construct delete query.
  let query: QueryProps = {
    name: "userDeleteQuery",
    text: "DELETE FROM users WHERE userid=$1",
    values: [deleteElement[2].value.toString()],
  };
  const { code, rows } = await performQuery(client, query);
  // Return the result of the delete query.
  res.status(code);
  next();
};

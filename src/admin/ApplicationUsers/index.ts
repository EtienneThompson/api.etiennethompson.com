import { Request, Response, NextFunction } from "express";
import { QueryProps, DatabaseConnection } from "../../utils/database";
import { AdminGetResponseData, DefaultValues } from "../../types";
import { Application, ApplicationUser, ReturnAppUser, User } from "../types";
import {
  ErrorStatusCode,
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../../utils/response";

/**
 * Gets a list of all application users.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const getApplicationUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Template for all the data required.
  let responseData: AdminGetResponseData = {
    elements: [],
    headers: [],
    editableFields: [],
    newFields: [],
    defaultValues: [],
  };
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;

  // Get the list of all users.
  let query: QueryProps = {
    name: "userGetQuery",
    text: "SELECT userid, username FROM users;",
    values: [],
  };
  let userRows: User[] = await client.PerformQuery(query);

  // Get the list of all applications.
  query = {
    name: "appGetQuery",
    text: "SELECT applicationid, applicationname FROM applications;",
    values: [],
  };
  let appRows: Application[] = await client.PerformQuery(query);

  // Get the list of all application users.
  query = {
    name: "appUserGetQuery",
    text: "SELECT userid, applicationid, isuser, isadmin FROM applicationusers;",
    values: [],
  };
  let appUsers: ApplicationUser[] = await client.PerformQuery(query);

  // Construct a list of all app users with actual usernames and app names.
  appUsers.map((row) => {
    responseData.elements.push({
      user: userRows.filter((user) => user.userid === row.userid)[0].username,
      application: appRows.filter(
        (app) => app.applicationid === row.applicationid
      )[0].applicationname,
      isuser: row.isuser,
      isadmin: row.isadmin,
    });
  });

  let allHeaders = [
    { text: "User", field: "user", type: "select" },
    { text: "Application", field: "application", type: "select" },
    { text: "User Status", field: "isuser", type: "checkbox" },
    { text: "Admin Status", field: "isadmin", type: "checkbox" },
  ];
  // Fields to display in the table.
  responseData.headers = [
    { text: "User", field: "user" },
    { text: "Application", field: "application" },
    { text: "User Status", field: "isuser" },
    { text: "Admin Status", field: "isadmin" },
  ];
  // Fields to display when editing an element.
  responseData.editableFields = [
    { text: "User", field: "user", edit: false },
    { text: "Application", field: "application", edit: false },
    { text: "User Status", field: "isuser", edit: true },
    { text: "Admin Status", field: "isadmin", edit: true },
  ];
  // Fields to display when creating a new element.
  responseData.newFields = [
    { text: "User", field: "user" },
    { text: "Application", field: "application" },
    { text: "User Status", field: "isuser" },
    { text: "Admin Status", field: "isadmin" },
  ];

  // Set default values with user and application details.
  allHeaders.map((header) => {
    responseData.defaultValues.push({
      id: header.field,
      value: header.type === "select" ? "---" : false,
      label: header.text,
      component: header.type,
      editable: false,
      options:
        header.type === "select"
          ? header.field === "user"
            ? userRows.map((user) => {
                return {
                  id: user.userid,
                  value: user.userid,
                  text: user.username,
                };
              })
            : appRows.map((app) => {
                return {
                  id: app.applicationid,
                  value: app.applicationid,
                  text: app.applicationname,
                };
              })
          : [],
    });
  });

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, responseData);
};

/**
 * Creates a new application user based on given fields.
 * @param req The Express request object. Requires the application user fields
 *    as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const createApplicationUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const newElement = req.body.newElement as DefaultValues[];

  // Construct query to create the new application user.
  let query: QueryProps = {
    name: "appUserInsertQuery",
    text: "INSERT INTO applicationusers (userid, applicationid, isuser, isadmin) VALUES ($1, $2, $3, $4) RETURNING *;",
    values: [
      newElement[0].value.toString(),
      newElement[1].value.toString(),
      newElement[2].value.toString() === "true",
      newElement[3].value.toString() === "true",
    ],
  };
  await client.PerformQuery(query);

  let newAppUser: ReturnAppUser = {
    user: newElement[0].options
      ? newElement[0].options.filter(
          (opt: any) => opt.id === newElement[0].value
        )[0].text
      : "",
    application: newElement[1].options
      ? newElement[1].options.filter(
          (opt: any) => opt.id === newElement[1].value
        )[0].text
      : "",
    isuser: newElement[2].value === "true",
    isadmin: newElement[3].value === "true",
  };
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    newElement: newAppUser,
  });
};

/**
 * Update the fields of an application user based on given fields.
 * @param req The Express request object. Requires the application user fields
 *    as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const updateApplicationUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  var updateElement = req.body.updateElement as DefaultValues[];

  // Construct the query, filtering the given user and application for their
  // actual id.
  let query: QueryProps = {
    name: "appUserUpdateQuery",
    text: "UPDATE applicationusers SET isuser=$1, isadmin=$2 WHERE userid=$3 AND applicationid=$4;",
    values: [
      updateElement[2].value === "true",
      updateElement[3].value === "true",
      updateElement[0].options
        ? updateElement[0].options.filter(
            (opt: any) => opt.text === updateElement[0].value
          )[0].id
        : "",
      updateElement[1].options
        ? updateElement[1].options.filter(
            (opt: any) => opt.text === updateElement[1].value
          )[0].id
        : "",
    ],
  };
  await client.PerformQuery(query);

  let updateAppUser: ReturnAppUser = {
    user: updateElement[0].value.toString(),
    application: updateElement[1].value.toString(),
    isuser: updateElement[2].value.toString() === "true",
    isadmin: updateElement[3].value.toString() === "true",
  };
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    updatedElement: updateAppUser,
  });
};

/**
 * Delete a given application user.
 * @param req The Express request object. Requires the application user fields
 *    as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const deleteApplicationUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  var deleteElement = req.body.deleteElement as DefaultValues[];

  // Construct the query, replacing the user and application fields with their
  // respective ids.
  let query: QueryProps = {
    name: "appUserDeleteQuery",
    text: "DELETE FROM applicationusers WHERE userid=$1 AND applicationid=$2;",
    values: [
      deleteElement[0].options
        ? deleteElement[0].options.filter(
            (opt: any) => opt.text === deleteElement[0].value
          )[0].id
        : "",
      deleteElement[1].options
        ? deleteElement[1].options.filter(
            (opt: any) => opt.text === deleteElement[1].value
          )[0].id
        : "",
    ],
  };

  await client.PerformQuery(query);
  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

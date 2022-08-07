import { Request, Response } from "express";
import { QueryProps, performQuery } from "../../utils/database";
import { AdminGetResponseData, DefaultValues } from "../../types";
import { ApplicationUser, ReturnAppUser } from "./types";

/**
 * Gets a list of all application users.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const getApplicationUsers = async (
  req: Request,
  res: Response,
  next: any
) => {
  // Template for all the data required.
  let responseData: AdminGetResponseData = {
    elements: [],
    headers: [],
    editableFields: [],
    newFields: [],
    defaultValues: [],
  };
  const client = req.body.client;

  // Get the list of all users.
  let query: QueryProps = {
    name: "userGetQuery",
    text: "SELECT userid, username FROM users;",
    values: [],
  };
  let users: any[] = [];
  let { code, rows } = await performQuery(client, query);
  if (code === 200) {
    users = rows;
  }

  // Get the list of all applications.
  query = {
    name: "appGetQuery",
    text: "SELECT applicationid, applicationname FROM applications;",
    values: [],
  };
  let apps: any[] = [];
  ({ code, rows } = await performQuery(client, query));
  if (code === 200) {
    apps = rows;
  }

  // Get the list of all application users.
  query = {
    name: "appUserGetQuery",
    text: "SELECT userid, applicationid, isuser, isadmin FROM applicationusers;",
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));

  // Construct a list of all app users with actual usernames and app names.
  if (code === 200) {
    rows.map((row: ApplicationUser) => {
      responseData.elements.push({
        user: users.filter((user) => user.userid === row.userid)[0].username,
        application: apps.filter(
          (app) => app.applicationid === row.applicationid
        )[0].applicationname,
        isuser: row.isuser,
        isadmin: row.isadmin,
      });
    });
  }

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
            ? users.map((user) => {
                return {
                  id: user.userid,
                  value: user.userid,
                  text: user.username,
                };
              })
            : apps.map((app) => {
                return {
                  id: app.applicationid,
                  value: app.applicationid,
                  text: app.applicationname,
                };
              })
          : [],
    });
  });

  res.status(200).write(JSON.stringify(responseData));
  next();
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
  next: any
) => {
  const client = req.body.client;
  const newElement = req.body.newElement as DefaultValues[];

  // Construct query to create the new application user.
  let query: QueryProps = {
    name: "appUserInsertQuery",
    text: "INSERT INTO applicationusers (userid, applicationid, isuser, isadmin) VALUES ($1, $2, $3, $4);",
    values: [
      newElement[0].value.toString(),
      newElement[1].value.toString(),
      newElement[2].value.toString() === "true",
      newElement[3].value.toString() === "true",
    ],
  };
  const { code, rows } = await performQuery(client, query);

  // Return data based on query code, setting the user and application based on
  // the ids.
  if (code === 200) {
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
    res.status(200).write(JSON.stringify({ newElement: newAppUser }));
  } else {
    res
      .status(500)
      .write(JSON.stringify({ message: "Failed to create app user. " }));
  }
  next();
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
  next: any
) => {
  const client = req.body.client;
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
  const { code, rows } = await performQuery(client, query);

  // Send back the information based on code.
  if (code === 200) {
    let updateAppUser: ReturnAppUser = {
      user: updateElement[0].value.toString(),
      application: updateElement[1].value.toString(),
      isuser: updateElement[2].value.toString() === "true",
      isadmin: updateElement[3].value.toString() === "true",
    };
    res.status(200).write(JSON.stringify({ updatedElement: updateAppUser }));
  } else {
    res
      .status(500)
      .write(
        JSON.stringify({ message: "The application user failed to update." })
      );
  }
  next();
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
  next: any
) => {
  const client = req.body.client;
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

  // Send back the result of the operation.
  const { code, rows } = await performQuery(client, query);
  res.status(code);
  next();
};

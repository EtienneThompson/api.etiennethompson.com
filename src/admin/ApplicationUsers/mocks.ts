import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { AdminGetResponseData, DefaultValues } from "../../types";
import { ApplicationUser, ReturnAppUser } from "./types";

export const mockGetApplicationUsers = async (
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

  // Generate a random set of users.
  let users = [
    {
      userid: "9bbf85e0-c9ec-466b-93de-46a61059b010",
      username: "Steven",
      clientid: "893931e2-f802-4c41-90d5-e7bb5f3e050a",
    },
    {
      userid: "274bee8b-d0c0-4365-9e62-801b6bbd7209",
      username: "Linda",
      clientid: "fb10a508-43fb-4cbb-b819-679bff73fd0e",
    },
    {
      userid: "2b142064-6697-44a4-ae75-113651d75f5d",
      username: "Kennedy",
      clientid: "6cd1d483-e89c-491c-90cd-cc5dae752f67",
    },
  ];

  // Generate a random set of applications.
  let apps = [
    {
      applicationid: "17f178c4-dd55-4b3e-b824-3a2240b5a5ec",
      applicationname: "Admin Center",
      redirecturl: "a test redirect url",
    },
    {
      applicationid: "843c1810-b6fa-481f-9bf2-dc649974bd9d",
      applicationname: "Inventory System",
      redirecturl: "a test redirect url",
    },
  ];

  // Generate a random set of application users.
  let appUsers: ApplicationUser[] = [
    {
      userid: "9bbf85e0-c9ec-466b-93de-46a61059b010",
      applicationid: "17f178c4-dd55-4b3e-b824-3a2240b5a5ec",
      isuser: true,
      isadmin: false,
    },
    {
      userid: "274bee8b-d0c0-4365-9e62-801b6bbd7209",
      applicationid: "843c1810-b6fa-481f-9bf2-dc649974bd9d",
      isuser: true,
      isadmin: false,
    },
    {
      userid: "2b142064-6697-44a4-ae75-113651d75f5d",
      applicationid: "17f178c4-dd55-4b3e-b824-3a2240b5a5ec",
      isuser: false,
      isadmin: true,
    },
  ];

  appUsers.map((row: ApplicationUser) => {
    responseData.elements.push({
      user: users.filter((user) => user.userid === row.userid)[0].username,
      application: apps.filter(
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
};

export const mockCreateApplicationUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const newElement = req.body.newElement as DefaultValues[];
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
};

export const mockUpdateApplicationuser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  var updateElement = req.body.updateElement as DefaultValues[];
  let updateAppUser: ReturnAppUser = {
    user: updateElement[0].value.toString(),
    application: updateElement[1].value.toString(),
    isuser: updateElement[2].value.toString() === "true",
    isadmin: updateElement[3].value.toString() === "true",
  };
  res.status(200).write(JSON.stringify({ updatedElement: updateAppUser }));
};

export const mockDeleteApplicationUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(200);
};

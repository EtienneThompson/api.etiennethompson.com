import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { AdminGetResponseData, DefaultValues } from "../../types";
import {
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../../utils/response";
import { ReturnUser } from "./types";

export const mockGetUsers = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let responseData: AdminGetResponseData = {
    elements: [],
    headers: [],
    editableFields: [],
    newFields: [],
    defaultValues: [],
  };

  const responseHelper = req.body.response as ResponseHelper;

  // Generate a random set of users.
  responseData.elements = [
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

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, responseData);
};

export const mockCreateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const responseHelper = req.body.response as ResponseHelper;
  const newElement = req.body.newElement as DefaultValues[];
  let newUserId = uuidv4();
  let newClientId = uuidv4();

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

export const mockUpdateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const responseHelper = req.body.response as ResponseHelper;
  const updateElement = req.body.updateElement as DefaultValues[];

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

export const mockDeleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const responseHelper = req.body.response as ResponseHelper;
  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

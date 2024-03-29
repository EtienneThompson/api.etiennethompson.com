import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { AdminGetResponseData, DefaultValues } from "../../types";
import {
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../../utils/response";
import { ReturnApp } from "../types";

export const mockGetApplications = async (
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

  // Generate a random set of applications.
  responseData.elements = [
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

export const mockCreateApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const responseHelper = req.body.response as ResponseHelper;
  const newElement = req.body.newElement as DefaultValues[];
  let newAppId = uuidv4();

  let newApp: ReturnApp = {
    applicationid: newAppId,
    applicationname: newElement[1].value.toString(),
    redirecturl: newElement[2].value.toString(),
  };
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    newElement: newApp,
  });
};

export const mockUpdateApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const responseHelper = req.body.response as ResponseHelper;
  const updateElement = req.body.updateElement as DefaultValues[];

  let udpatedApp: ReturnApp = {
    applicationid: updateElement[0].value.toString(),
    applicationname: updateElement[1].value.toString(),
    redirecturl: updateElement[2].value.toString(),
  };
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    updateElement,
    udpatedApp,
  });
};

export const mockDeleteApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const responseHelper = req.body.response as ResponseHelper;
  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

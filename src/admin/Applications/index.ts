import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, performQuery } from "../../utils/database";
import { Applications, CreateApplicationsRequest } from "./types";
import { GetResponseData } from "../Users/types";

export const getApplications = async (
  req: Request,
  res: Response,
  next: any
) => {
  let responseData: GetResponseData = {
    elements: [],
    headers: [],
    editableFields: [],
    newFields: [],
    defaultValues: [],
  };
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

  allHeaders.map((header) => {
    responseData.defaultValues.push({
      id: header.field,
      value: "",
      label: header.text,
      component: header.type,
      editable: false,
    });
  });

  res.status(200);
  res.write(JSON.stringify(responseData));
  next();
};

export const createApplication = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  const newElement = req.body.newElement;

  // Generate a new application id.
  const newAppId = uuidv4();
  newElement.filter((field: any) => field.id === "applicationid")[0].value =
    newAppId;

  let query: QueryProps = {
    name: "appInsertQuery",
    text: "INSERT INTO applications (applicationid, applicationname, redirecturl) VALUES ($1, $2, $3);",
    values: [newElement[0].value, newElement[1].value, newElement[2].value],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    let newApp: Applications = {
      applicationid: newElement[0].value,
      applicationname: newElement[1].value,
      redirecturl: newElement[2].value,
    };
    res.status(200);
    res.write(JSON.stringify({ newElement: newApp }));
  } else {
    res.status(500);
    res.write(
      JSON.stringify({ message: "Failed to create the application." })
    );
  }
  next();
};

export const updateApplication = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var updateElement = req.body.updateElement;

  let query: QueryProps = {
    name: "appUpdateQuery",
    text: "UPDATE applications SET applicationname=$1, redirecturl=$2 WHERE applicationid=$3",
    values: [
      updateElement[1].value,
      updateElement[2].value,
      updateElement[0].value,
    ],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
    let udpatedApp: Applications = {
      applicationid: updateElement[0].value,
      applicationname: updateElement[1].value,
      redirecturl: updateElement[2].value,
    };
    res.write(JSON.stringify({ updatedElement: udpatedApp }));
  } else {
    res.status(500);
    res.write(
      JSON.stringify({ message: "The application failed to update." })
    );
  }
  next();
};

export const deleteApplication = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var deleteElement = req.body.deleteElement;

  let query: QueryProps = {
    name: "appDeleteQuery",
    text: "DELETE FROM applications WHERE applicationid=$1;",
    values: [deleteElement[0].value],
  };
  const { code, rows } = await performQuery(client, query);
  res.status(code);
  next();
};

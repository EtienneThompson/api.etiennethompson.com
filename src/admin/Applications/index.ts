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
  // const client = req.body.client;
  // // select applicationname, redirecturl from applications;
  // let query: QueryProps = {
  //   name: "appGetQuery",
  //   text: "SELECT * FROM applications;",
  //   values: [],
  // };
  // const { code, rows } = await performQuery(client, query);
  // if (code === 200 && !rows) {
  //   res.status(400);
  //   res.write(JSON.stringify({ message: "No applications were found." }));
  // } else {
  //   res.status(200);
  //   res.write(JSON.stringify({ applications: rows }));
  // }
  // next();

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

  let allHeaders = ["Application ID", "Application Name", "Redirect URL"];
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
      id: header,
      value: "",
      label: header,
      component: "text",
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
  // insert into applications (applicationid, applicationname, redirecturl) values (...);
  var newApplication = req.body.newApplication as CreateApplicationsRequest;

  // Generate a new applicationid.
  const newApplicationId = uuidv4();

  let query: QueryProps = {
    name: "appInsertQuery",
    text: "INSERT INTO applications (applicationid, applicationname, redirecturl) VALUES ($1, $2, $3);",
    values: [
      newApplicationId,
      newApplication.applicationname,
      newApplication.redirecturl,
    ],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdApplication: {
          applicationid: newApplicationId,
          applicationname: newApplication.applicationname,
          redirecturl: newApplication.redirecturl,
        },
      })
    );
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "No applications were created" }));
  }
  next();
};

export const updateApplication = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  // update applications set applicationname = '${appicationname}', redirecturl = '${redirecturl}' where applicationid='${applicationid}';
  var reqBody = req.body.application as Applications;

  let query: QueryProps = {
    name: "appUpdateQuery",
    text: "UPDATE applications SET applicationname=$1, redirecturl=$2 WHERE applicationid=$3;",
    values: [
      reqBody.applicationname,
      reqBody.redirecturl,
      reqBody.applicationid,
    ],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
  } else {
    res.status(404);
    res.write(
      JSON.stringify({ message: "An application for that id does not exist." })
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
  var reqBody = req.body.application as Applications;

  let query: QueryProps = {
    name: "appDeleteQuery",
    text: "DELETE FROM applications WHERE applicationid=$1;",
    values: [reqBody.applicationid],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
  } else {
    res.status(404);
    res.write(
      JSON.stringify({ message: "An application for that id does not exist." })
    );
  }
  next();
};

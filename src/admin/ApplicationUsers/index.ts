import { Request, response, Response } from "express";
import { QueryProps, performQuery } from "../../utils/database";
import { GetResponseData } from "../Users/types";
import { ApplicationUser } from "./types";

export const getApplicationUsers = async (
  req: Request,
  res: Response,
  next: any
) => {
  // const client = req.body.client;

  // let query: QueryProps = {
  //   name: "applicationUserGetQuery",
  //   text: "SELECT * FROM applicationusers;",
  //   values: [],
  // };
  // const { code, rows } = await performQuery(client, query);
  // if (code === 200 && !rows) {
  //   res.status(400);
  //   res.write(JSON.stringify({ message: "No application users were found." }));
  // } else {
  //   res.status(200);
  //   res.write(JSON.stringify({ applicationUsers: rows }));
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
    name: "userGetQuery",
    text: "SELECT userid, username FROM users;",
    values: [],
  };
  let users: any[] = [];
  let { code, rows } = await performQuery(client, query);
  if (code === 200) {
    users = rows;
  }

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

  query = {
    name: "appUserGetQuery",
    text: "SELECT userid, applicationid, isuser, isadmin FROM applicationusers;",
    values: [],
  };
  ({ code, rows } = await performQuery(client, query));

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

  res.status(200);
  res.write(JSON.stringify(responseData));
  next();
};

export const createApplicationUser = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var newApplicationUser = req.body.newApplicationUser as ApplicationUser;

  let query: QueryProps = {
    name: "appUserInsertQuery",
    text: "INSERT INTO applicationusers (userid, applicationid, isuser, isadmin) VALUES ($1, $2, $3, $4);",
    values: [
      newApplicationUser.userid,
      newApplicationUser.applicationid,
      String(newApplicationUser.isuser),
      String(newApplicationUser.isadmin),
    ],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdApplicationUser: {
          userid: newApplicationUser.userid,
          applicationid: newApplicationUser.applicationid,
          isuser: newApplicationUser.isuser,
          isadmin: newApplicationUser.isadmin,
        },
      })
    );
  } else {
    res.status(500);
  }
  next();
};

export const updateApplicationUser = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var reqBody = req.body.applicationuser as ApplicationUser;

  let query: QueryProps = {
    name: "appUserUpdateQuery",
    text: "UPDATE applicationusers SET isuser=$1, isadmin=$2 WHERE userid=$3 AND applicationid=$4;",
    values: [
      String(reqBody.isuser),
      String(reqBody.isadmin),
      reqBody.userid,
      reqBody.applicationid,
    ],
  };
  const { code, rows } = await performQuery(client, query);

  res.status(code);
  next();
};

export const deleteApplicationUser = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var reqBody = req.body.applicationuser as ApplicationUser;

  let query: QueryProps = {
    name: "appUserDeleteQuery",
    text: "DELETE FROM applicationusers WHERE userid=$1 AND applicationid=$2;",
    values: [reqBody.userid, reqBody.applicationid],
  };
  const { code, rows } = await performQuery(client, query);

  res.status(code);
  next();
};

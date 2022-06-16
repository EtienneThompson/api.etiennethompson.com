import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, performQuery } from "../../utils/database";
import { createExpiration } from "../../utils/date";
import { AdminGetResponseData } from "../../types";
import { ReturnUser } from "./types";

export const getUsers = async (req: Request, res: Response, next: any) => {
  let responseData: AdminGetResponseData = {
    elements: [],
    headers: [],
    editableFields: [],
    newFields: [],
    defaultValues: [],
  };
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

export const createUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  const newElement = req.body.newElement;

  const newUserId = uuidv4();
  const newClientId = uuidv4();
  let expiration = createExpiration();

  let query: QueryProps = {
    name: "userCreateQuery",
    text: "INSERT INTO users (userid, username, password, clientid, session_expiration) VALUES ($1, $2, $3, $4, $5);",
    values: [
      newUserId,
      newElement[0].value,
      newElement[1].value,
      newClientId,
      expiration,
    ],
  };

  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
    let newUser: ReturnUser = {
      userid: newUserId,
      username: newElement[0].value,
      clientid: newClientId,
    };
    res.write(JSON.stringify({ newElement: newUser }));
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "Failed to create user." }));
  }

  next();
};

export const updateUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  var updateElement = req.body.updateElement;

  let query: QueryProps = {
    name: "userUpdateQuery",
    text: "UPDATE users SET username=$1 WHERE userid=$2;",
    values: [updateElement[0].value, updateElement[2].value],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
    let updateUser: ReturnUser = {
      userid: updateElement[2].value,
      username: updateElement[0].value,
      clientid: updateElement[3].value,
    };
    res.write(JSON.stringify({ updatedElement: updateUser }));
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "The user failed to update." }));
  }
  next();
};

export const deleteUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  var deleteElement = req.body.deleteElement;

  let query: QueryProps = {
    name: "userDeleteQuery",
    text: "DELETE FROM users WHERE userid=$1",
    values: [deleteElement[2].value],
  };
  const { code, rows } = await performQuery(client, query);
  res.status(code);
  next();
};

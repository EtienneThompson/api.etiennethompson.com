import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { QueryProps, performQuery } from "../../utils/database";
import { createExpiration } from "../../utils/date";
import {
  Users,
  CreateRequestUsers,
  UpdateUserRequest,
  DeleteUserRequest,
} from "./types";

export const getUsers = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // select username, hashedPassword from users;
  let query: QueryProps = {
    name: "userGetQuery",
    text: "SELECT * FROM users;",
    values: [],
  };
  const { code, rows } = await performQuery(client, query);
  if (code === 200 && !rows) {
    res.status(400);
    res.write(JSON.stringify({ message: "no users were found." }));
  } else {
    res.status(200);
    res.write(JSON.stringify({ users: rows }));
  }
  next();
};

export const createUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // insert into users (username, hashedPassword) values ('${username}', '${hashedPassword}');
  var newUser = req.body.newUser as CreateRequestUsers;

  // Generate a new user and client Id here too.
  const newUserId = uuidv4();
  const newClientId = uuidv4();
  let expiration = createExpiration();

  let query: QueryProps = {
    name: "userCreateQuery",
    text: "INSERT INTO users (userid, username, password, clientid, session_expiration) VALUES ($1, $2, $3, $4, $5);",
    values: [
      newUserId,
      newUser.username,
      newUser.password,
      newClientId,
      expiration,
    ],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdUser: {
          username: newUser.username,
          userid: newUserId,
          clientid: newClientId,
        },
      })
    );
  } else {
    res.status(500);
  }
  next();
};

export const updateUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // update users set username = '${username}', hashedPassword = '${hashedPassword}' where userId='${userId}';
  var reqBody = req.body.user as UpdateUserRequest;

  let query: QueryProps = {
    name: "userUpdateQuery",
    text: "UPDATE users SET username=$1 WHERE userid=$2;",
    values: [reqBody.username, reqBody.userid],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
  } else {
    res.status(404);
  }
  next();
};

export const deleteUser = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // delete from users where userId = '${userId}';
  var reqBody = req.body as DeleteUserRequest;

  let query: QueryProps = {
    name: "userDeleteQuery",
    text: "DELETE FROM users WHERE userid=$1;",
    values: [reqBody.userid],
  };
  const { code, rows } = await performQuery(client, query);

  if (code === 200) {
    res.status(200);
  } else {
    res.status(404);
  }
  next();
};

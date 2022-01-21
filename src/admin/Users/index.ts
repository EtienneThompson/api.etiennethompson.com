import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { performQuery } from "../../utils/database";
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
  const getUserQuery = "SELECT * FROM users;";
  const { code, rows } = await performQuery(client, getUserQuery);
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
  const createUserQuery = `INSERT INTO users (userid, username, password, clientId, session_expiration) VALUES ('${newUserId}', '${newUser.username}', '${newUser.password}', '${newClientId}', '${expiration}');`;
  const { code, rows } = await performQuery(client, createUserQuery);

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

  const updateUserQuery = `UPDATE users SET username = '${reqBody.username}' WHERE userid = '${reqBody.userid}';`;
  const { code, rows } = await performQuery(client, updateUserQuery);

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

  const deleteUserQuery = `DELETE FROM users WHERE userid='${reqBody.userid}'`;
  const { code, rows } = await performQuery(client, deleteUserQuery);

  if (code === 200) {
    res.status(200);
  } else {
    res.status(404);
  }
  next();
};

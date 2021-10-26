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

export const getUsers = async (req: Request, res: Response) => {
  // select username, hashedPassword from users;
  const getUserQuery = "SELECT * FROM users;";
  const { code, rows } = await performQuery(getUserQuery);
  if (code === 200 && !rows) {
    res.status(400);
    res.send({ message: "no users were found." });
  }

  res.status(200);
  res.send({ users: rows });
};

export const createUser = async (req: Request, res: Response) => {
  // insert into users (username, hashedPassword) values ('${username}', '${hashedPassword}');
  var reqBody = req.body.newUsers as CreateRequestUsers[];
  let createdUsers = [] as Users[];

  await reqBody.forEach(async (newUser) => {
    // Generate a new user and client Id here too.
    const newUserId = uuidv4();
    const newClientId = uuidv4();
    let expiration = createExpiration();
    const createUserQuery = `INSERT INTO users (userid, username, password, clientId, session_expiration) VALUES ('${newUserId}', '${newUser.username}', '${newUser.password}', '${newClientId}', '${expiration}');`;
    const { code, rows } = await performQuery(createUserQuery);
    if (code === 200) {
      createdUsers.push(rows[0]);
    }
  });

  if (createdUsers) {
    res.status(200);
    res.send({ createUsers: createdUsers });
  } else {
    res.status(500);
    res.send();
  }
};

export const updateUser = async (req: Request, res: Response) => {
  // update users set username = '${username}', hashedPassword = '${hashedPassword}' where userId='${userId}';
  var reqBody = req.body.user as UpdateUserRequest;

  const updateUserQuery = `UPDATE users SET username = '${reqBody.username}' WHERE userid = '${reqBody.userid}';`;
  const { code, rows } = await performQuery(updateUserQuery);

  if (code === 200) {
    res.status(200);
    res.send();
  } else {
    res.status(404);
    res.send();
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  // delete from users where userId = '${userId}';
  var reqBody = req.body as DeleteUserRequest;

  const deleteUserQuery = `DELETE FROM users WHERE userid='${reqBody.userid}'`;
  const { code, rows } = await performQuery(deleteUserQuery);

  if (code === 200) {
    res.status(200);
    res.send();
  } else {
    res.status(404);
    res.send();
  }
};

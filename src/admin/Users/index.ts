import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { connectToDatabase, performQuery } from "../../utils/database";
import { Users, CreateRequestUsers, UpdateUserRequest } from "./types";

export const getUsers = async (req: Request, res: Response) => {
  // select username, hashedPassword from users;
  const client = connectToDatabase();

  const getUserQuery = "select * from users;";
  const { code, rows } = await performQuery(client, getUserQuery);
  if (code === 200 && !rows) {
    client.end();
    res.status(400);
    res.send({ message: "no users were found." });
  }

  res.status(200);
  res.send({ users: rows });
};

export const createUser = async (req: Request, res: Response) => {
  // insert into users (username, hashedPassword) values ('${username}', '${hashedPassword}');
  console.log("creating a user");
  var reqBody = req.body as CreateRequestUsers[];

  const client = connectToDatabase();

  let createdUsers = [] as Users[];

  reqBody.forEach(async (newUser) => {
    // Generate a new user and client Id here too.
    const newUserId = uuidv4();
    const newClientId = uuidv4();
    const createUserQuery = `insert into users (userid, username, password, clientId) values ('${newUserId}', '${newUser.username}', '${newUser.password}', '${newClientId}');`;
    const { code, rows } = await performQuery(client, createUserQuery);
    if (code === 200) {
      createdUsers.push(rows[0]);
    }
  });

  client.end();

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
  console.log("updating a user");
  var reqBody = req.body as UpdateUserRequest;
  const client = connectToDatabase();

  console.log(reqBody.username);
  const updateUserQuery = `update users set username = '${reqBody.username}' where userid = '${reqBody.userId}'`;
  const { code, rows } = await performQuery(client, updateUserQuery);
  console.log(code);

  client.end();

  if (code === 200) {
    res.status(200);
    res.send();
  } else {
    res.status(404);
    res.send();
  }
};

export const deleteUser = (req: Request, res: Response) => {
  // delete from users where userId = '${userId}';
  console.log("deleting a user");
  res.send("deleting a user");
};

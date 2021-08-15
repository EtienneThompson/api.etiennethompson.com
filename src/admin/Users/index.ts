import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { connectToDatabase, performQuery } from "../../utils/database";
import { CreateUserRequest } from "./types";

export const getUsers = async (req: Request, res: Response) => {
  // select username, hashedPassword from users;
  const client = connectToDatabase();

  const getUserQuery = "select username from users;";
  const userRows = await performQuery(client, getUserQuery);
  if (!userRows) {
    client.end();
    res.status(400);
    res.send({ message: "no users were found." });
  }

  res.status(200);
  res.send({ users: userRows });
};

export const createUser = async (req: Request, res: Response) => {
  // insert into users (username, hashedPassword) values ('${username}', '${hashedPassword}');
  console.log("creating a user");
  var reqBody = req.body as CreateUserRequest;

  const client = connectToDatabase();

  // Generate a clientId here too.
  const newClientId = uuidv4();

  const createUserQuery = `insert into users (username, hashedPassword, clientId) values ('${reqBody.username}', '${reqBody.hashedPassword}', '${newClientId}');`;
  const createUserRows = await performQuery(client, createUserQuery);
  console.log(createUserRows);

  res.status(200);
  res.send("creating a user");
};

export const updateUser = (req: Request, res: Response) => {
  // update users set username = '${username}', hashedPassword = '${hashedPassword}' where userId='${userId}';
  console.log("updating a user");
  res.send("updating a user");
};

export const deleteUser = (req: Request, res: Response) => {
  // delete from users where userId = '${userId}';
  console.log("deleting a user");
  res.send("deleting a user");
};

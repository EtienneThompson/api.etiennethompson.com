import e, { Request, Response } from "express";
import { LoginRequest, UserEntry, ApplicationEntry } from "./types";
import { connectToDatabase, performQuery } from "../utils/database";

export const loginHandler = async (req: Request, res: Response) => {
  var requestBody = req.body as LoginRequest;

  const client = connectToDatabase();

  // Verify that the user exists and get the user's client id.
  let clientId: string = "";
  const userQuery = `SELECT * FROM users WHERE username='${requestBody.username}' AND password='${requestBody.hashedPassword}'`;
  let { code, rows } = await performQuery(client, userQuery);
  if (code === 200 && rows) {
    const entry = rows[0] as UserEntry;
    clientId = entry.clientid;
  } else {
    // No results, return an error message.
    client.end();
    res.status(404);
    res.send({ message: "That user doesn't exist" });
  }

  // Verify the application exists and get the redirect url for that application.
  let redirectUrl: string = "";
  const applicationQuery = `SELECT * FROM applications WHERE applicationid='${requestBody.appid}'`;
  ({ code, rows } = await performQuery(client, applicationQuery));
  if (code === 200 && rows) {
    const entry = rows[0] as ApplicationEntry;
    redirectUrl = entry.redirecturl;
  } else {
    // No results, return an error message.
    client.end();
    res.status(404);
    res.send({ message: "That application doesn't exist." });
  }

  client.end();

  res.status(200);
  res.send({
    clientId: clientId,
    redirectUrl: redirectUrl,
  });
};

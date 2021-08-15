import e, { Request, Response } from "express";
import { LoginRequest, UserEntry, ApplicationEntry } from "./types";
import { connectToDatabase, performQuery } from "../utils/database";

export const loginHandler = async (req: Request, res: Response) => {
  var requestBody = req.body as LoginRequest;

  const client = connectToDatabase();

  let clientId: string = "";
  const userQuery = `SELECT * FROM users WHERE username='${requestBody.username}' AND password='${requestBody.hashedPassword}'`;
  const userRows = await performQuery(client, userQuery);
  if (userRows) {
    const entry = userRows[0] as UserEntry;
    clientId = entry.clientid;
  } else {
    client.end();
    res.status(404);
    res.send({ message: "That user doesn't exist/" });
  }

  let redirectUrl: string = "";
  const applicationQuery = `SELECT * FROM applications WHERE applicationid='${requestBody.appid}'`;
  const applicationRows = await performQuery(client, applicationQuery);
  if (applicationRows) {
    const entry = applicationRows[0] as ApplicationEntry;
    redirectUrl = entry.redirecturl;
  } else {
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

import e, { Request, Response } from "express";
import { LoginRequest, UserEntry, ApplicationEntry } from "./types";
import { connectToDatabase } from "../utils/database";

export const loginHandler = async (req: Request, res: Response) => {
  var requestBody = req.body as LoginRequest;

  const client = connectToDatabase();

  const user = await client.query(
    `SELECT * FROM users WHERE username='${requestBody.username}' AND password='${requestBody.hashedPassword}'`
  );
  let clientId: string = "";
  if (user) {
    if (user.rows.length === 0) {
      client.end();
      res.status(404);
      res.send({ message: "That user doesn't exist." });
      return;
    } else {
      const entry = user.rows[0] as UserEntry;
      clientId = entry.clientid;
    }
  } else {
    client.end();
  }

  const application = await client.query(
    `SELECT * FROM applications WHERE applicationid='${requestBody.appid}'`
  );
  let redirectUrl: string = "";
  if (application) {
    if (application.rows.length === 0) {
      client.end();
      res.status(404);
      res.send({ message: "That application doesn't exist." });
      return;
    } else {
      const appEntry = application.rows[0] as ApplicationEntry;
      redirectUrl = appEntry.redirecturl;
    }
  } else {
    client.end();
  }

  client.end();

  res.status(200);
  res.send({
    clientId: clientId,
    redirectUrl: redirectUrl,
  });
};

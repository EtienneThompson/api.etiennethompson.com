import e, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { LoginRequest, ApplicationEntry, UserAdminStatus } from "./types";
import { UserEntry } from "../types";
import { performQuery } from "../utils/database";
import { createExpiration } from "../utils/date";

export const loginHandler = async (req: Request, res: Response) => {
  const client = req.body.client;
  var requestBody = req.body as LoginRequest;

  // Verify that the user exists and get the user's client id.
  let clientId: string = "";
  let userId: string = "";
  const userQuery = `SELECT * FROM users WHERE username='${requestBody.username}' AND password='${requestBody.hashedPassword}'`;
  let { code, rows } = await performQuery(client, userQuery);
  if (code === 200 && rows) {
    const entry = rows[0] as UserEntry;
    clientId = entry.clientid;
    userId = entry.userid;
  } else {
    // No results, return an error message.
    res.status(404);
    res.send({ message: "That user doesn't exist" });
  }

  // Verify the application exists and get the redirect url for that application.
  let redirectUrl: string = "";
  const applicationQuery = `SELECT * FROM applications WHERE applicationid='${requestBody.appid}'`;
  ({ code, rows } = await performQuery(client, applicationQuery));
  if (code === 200 && rows) {
    rows = rows as ApplicationEntry[];
    for (let i = 0; i < rows.length; i++) {
      const entry = rows[i] as ApplicationEntry;
      if (entry.redirecturl.indexOf(requestBody.redirectBase)) {
        redirectUrl = entry.redirecturl;
        break;
      }
    }
    if (redirectUrl === "") {
      res.status(404).send({
        message: "Could not find matching redirect url for given base.",
      });
    }
  } else {
    // No results, return an error message.
    res.status(404);
    res.send({ message: "That application doesn't exist." });
  }

  // Get the user, admin status for the given user for the given application.
  const applicationUsersQuery = `SELECT isuser, isadmin FROM applicationusers WHERE userid='${userId}'`;
  ({ code, rows } = await performQuery(client, applicationUsersQuery));
  let isUser: boolean = false;
  let isAdmin: boolean = false;
  if (code !== 200) {
    res.status(404);
    res.send({
      message: "That user is not a member of the given application.",
    });
  } else {
    const appUsers = rows[0] as UserAdminStatus;
    isUser = appUsers.isuser;
    isAdmin = appUsers.isadmin;
  }

  // Generate a new clientId for the user.
  const newClientId = uuidv4();
  const expiration = createExpiration();
  const updateClientIdQuery = `UPDATE users SET clientid = '${newClientId}', session_expiration = '${expiration}' WHERE userid='${userId}'`;
  ({ code, rows } = await performQuery(client, updateClientIdQuery));
  if (code !== 200) {
    res.status(500);
    res.send({ message: "There was an unexpected error. " });
  }

  res.status(200);
  res.send({
    clientId: newClientId,
    redirectUrl: redirectUrl,
    isUser: isUser,
    isAdmin: isAdmin,
  });
};

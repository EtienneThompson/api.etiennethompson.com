import e, { Request, Response } from "express";
import { LoginRequest, ApplicationEntry, UserAdminStatus } from "./types";
import { UserEntry } from "../types";
import { performQuery } from "../utils/database";

export const loginHandler = async (req: Request, res: Response) => {
  var requestBody = req.body as LoginRequest;

  // Verify that the user exists and get the user's client id.
  let clientId: string = "";
  let userId: string = "";
  const userQuery = `SELECT * FROM users WHERE username='${requestBody.username}' AND password='${requestBody.hashedPassword}'`;
  let { code, rows } = await performQuery(userQuery);
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
  ({ code, rows } = await performQuery(applicationQuery));
  if (code === 200 && rows) {
    const entry = rows[0] as ApplicationEntry;
    redirectUrl = entry.redirecturl;
  } else {
    // No results, return an error message.
    res.status(404);
    res.send({ message: "That application doesn't exist." });
  }

  // Get the user, admin status for the given user for the given application.
  const applicationUsersQuery = `SELECT isuser, isadmin FROM applicationusers WHERE userid='${userId}'`;
  const applicationUsers = await performQuery(applicationUsersQuery);
  let isUser: boolean = false;
  let isAdmin: boolean = false;
  if (applicationUsers) {
    if (applicationUsers.rows.length === 0) {
      res.status(404);
      res.send({
        message: "That user is not a member of the given application.",
      });
    } else {
      const appUsers = applicationUsers.rows[0] as UserAdminStatus;
      isUser = appUsers.isuser;
      isAdmin = appUsers.isadmin;
    }
  }

  res.status(200);
  res.send({
    clientId: clientId,
    redirectUrl: redirectUrl,
    isUser: isUser,
    isAdmin: isAdmin,
  });
};

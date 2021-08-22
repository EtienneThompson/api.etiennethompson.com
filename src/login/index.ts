import e, { Request, Response } from "express";
import {
  LoginRequest,
  UserEntry,
  ApplicationEntry,
  UserAdminStatus,
} from "./types";
import { connectToDatabase } from "../utils/database";

export const loginHandler = async (req: Request, res: Response) => {
  var requestBody = req.body as LoginRequest;

  const client = connectToDatabase();

  const user = await client.query(
    `SELECT * FROM users WHERE username='${requestBody.username}' AND password='${requestBody.hashedPassword}'`
  );
  let clientId: string = "";
  let userId: string = "";
  if (user) {
    if (user.rows.length === 0) {
      client.end();
      res.status(404);
      res.send({ message: "That user doesn't exist." });
      return;
    } else {
      const entry = user.rows[0] as UserEntry;
      clientId = entry.clientid;
      userId = entry.userid;
    }
  }

  const application = await client.query(
    `SELECT * FROM applications WHERE applicationid='${requestBody.appid}'`
  );
  let redirectUrl: string = "";
  let applicationId: string = "";
  if (application) {
    if (application.rows.length === 0) {
      client.end();
      res.status(404);
      res.send({ message: "That application doesn't exist." });
      return;
    } else {
      const appEntry = application.rows[0] as ApplicationEntry;
      redirectUrl = appEntry.redirecturl;
      applicationId = appEntry.applicationid;
    }
  }

  // Get the user, admin status for the given user for the given application.
  const applicationUsers = await client.query(
    `SELECT isuser, isadmin FROM applicationusers WHERE userid='${userId}'`
  );
  let isUser: boolean = false;
  let isAdmin: boolean = false;
  if (applicationUsers) {
    if (applicationUsers.rows.length === 0) {
      client.end();
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

  client.end();
  res.status(200);
  res.send({
    clientId: clientId,
    redirectUrl: redirectUrl,
    isUser: isUser,
    isAdmin: isAdmin,
  });
};

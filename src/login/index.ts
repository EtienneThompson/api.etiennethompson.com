import e, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { LoginRequest, ApplicationEntry, UserAdminStatus } from "./types";
import { UserEntry } from "../types";
import { QueryProps, performQuery } from "../utils/database";
import { createExpiration } from "../utils/date";

export const loginHandler = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  var reqBody = req.body as LoginRequest;

  // Verify that the user exists and get the user's client id.
  let clientId: string = "";
  let userId: string = "";
  let session_expiration: string = "";
  let query: QueryProps = {
    name: "loginGetUserQuery",
    text: "SELECT * FROM users WHERE username=$1 AND password=$2;",
    values: [reqBody.username, reqBody.hashedPassword],
  };
  let { code, rows } = await performQuery(client, query);
  if (code === 200 && rows) {
    const entry = rows[0] as UserEntry;
    clientId = entry.clientid;
    userId = entry.userid;
    session_expiration = entry.session_expiration;
  } else {
    // No results, return an error message.
    res.status(404);
    res.write(JSON.stringify({ message: "That user doesn't exist" }));
    next();
    return;
  }

  // Verify the application exists and get the redirect url for that application.
  let redirectUrl: string = "";
  query = {
    name: "loginGetApplicationQuery",
    text: "SELECT * FROM applications WHERE applicationid=$1;",
    values: [reqBody.appid],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code === 200 && rows) {
    rows = rows as ApplicationEntry[];
    for (let i = 0; i < rows.length; i++) {
      const entry = rows[i] as ApplicationEntry;
      if (entry.redirecturl.indexOf(reqBody.redirectBase)) {
        redirectUrl = entry.redirecturl;
        break;
      }
    }
    if (redirectUrl === "") {
      res.status(404).write(
        JSON.stringify({
          message: "Could not find matching redirect url for given base.",
        })
      );
      next();
      return;
    }
  } else {
    // No results, return an error message.
    res.status(404);
    res.write(JSON.stringify({ message: "That application doesn't exist." }));
    next();
    return;
  }

  // Get the user, admin status for the given user for the given application.
  query = {
    name: "loginGetApplicationUsersQuery",
    text: "SELECT isuser, isadmin FROM applicationusers WHERE userid=$1",
    values: [userId],
  };
  ({ code, rows } = await performQuery(client, query));
  let isUser: boolean = false;
  let isAdmin: boolean = false;
  if (code !== 200) {
    res.status(404);
    res.write(
      JSON.stringify({
        message: "That user is not a member of the given application.",
      })
    );
    next();
    return;
  } else {
    const appUsers = rows[0] as UserAdminStatus;
    isUser = appUsers.isuser;
    isAdmin = appUsers.isadmin;
  }

  // Check if the user has a currently valid clientid, if they do, get that
  // and reset the session expiration.
  let diff = new Date(session_expiration).getTime() - new Date().getTime();
  let retClientId: string = "";
  if (diff < 0) {
    // Generate a new clientId for the user.
    retClientId = uuidv4();
    const expiration = createExpiration();
    query = {
      text: "UPDATE users SET clientid=$1, session_expiration=$2 WHERE userid=$3;",
      values: [retClientId, expiration, userId],
    };
    ({ code, rows } = await performQuery(client, query));
    if (code !== 200) {
      res.status(500);
      res.write(
        JSON.stringify({ message: "There was an unexpected error. " })
      );
      next();
      return;
    }
  } else {
    // Use the existing clientId.
    retClientId = clientId;
    const expiration = createExpiration();
    query = {
      text: "UPDATE users SET session_expiration=$1 WHERE userid=$2;",
      values: [expiration, userId],
    };
    ({ code, rows } = await performQuery(client, query));
    if (code != 200) {
      res.status(500);
      res.write(
        JSON.stringify({ message: "There was an unexpected error. " })
      );
      next();
      return;
    }
  }

  res.status(200);
  res.write(
    JSON.stringify({
      clientId: retClientId,
      redirectUrl: redirectUrl,
      isUser: isUser,
      isAdmin: isAdmin,
    })
  );
  next();
  return;
};

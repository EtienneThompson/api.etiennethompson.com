import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import aws from "aws-sdk";
import { LoginRequest, ApplicationEntry, UserAdminStatus } from "./types";
import { UserEntry } from "../types";
import { QueryProps, performQuery, getUserId } from "../utils/database";
import {
  createHourExpiration,
  createMinuteExpiration,
  getCurrentTimeField,
} from "../utils/date";

export const loginHandler = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  var reqBody = req.body as LoginRequest;

  // Verify that the user exists and get the user's client id.
  let clientId: string = "";
  let userId: string = "";
  let session_expiration: string = "";
  let query: QueryProps = {
    name: "loginGetUserQuery",
    text: "SELECT clientid, userid, session_expiration FROM users WHERE username=$1 AND password=$2;",
    values: [reqBody.username, reqBody.hashedPassword],
  };
  let { code, rows } = await performQuery(client, query);
  if (code === 200 && rows.length > 0) {
    const entry = rows[0] as UserEntry;
    clientId = entry.clientid;
    userId = entry.userid;
    session_expiration = entry.session_expiration;
  } else {
    // No results, return an error message.
    res
      .status(404)
      .write(JSON.stringify({ message: "That user doesn't exist" }));
    next();
    return;
  }

  // Verify the application exists and get the redirect url for that application.
  let redirectUrl: string = "";
  query = {
    name: "loginGetApplicationQuery",
    text: "SELECT redirecturl FROM applications WHERE applicationid=$1;",
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
    res
      .status(404)
      .write(JSON.stringify({ message: "That application doesn't exist." }));
    next();
    return;
  }

  // Get the user, admin status for the given user for the given application.
  query = {
    name: "loginGetApplicationUsersQuery",
    text: "SELECT isuser, isadmin FROM applicationusers WHERE userid=$1 AND applicationid=$2",
    values: [userId, reqBody.appid],
  };
  ({ code, rows } = await performQuery(client, query));
  let isUser: boolean = false;
  let isAdmin: boolean = false;
  if (code !== 200) {
    res.status(404).write(
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
    const expiration = createHourExpiration();
    query = {
      text: "UPDATE users SET clientid=$1, session_expiration=$2 WHERE userid=$3;",
      values: [retClientId, expiration, userId],
    };
    ({ code, rows } = await performQuery(client, query));
    if (code !== 200) {
      res
        .status(500)
        .write(JSON.stringify({ message: "There was an unexpected error. " }));
      next();
      return;
    }
  } else {
    // Use the existing clientId.
    retClientId = clientId;
    const expiration = createHourExpiration();
    query = {
      text: "UPDATE users SET session_expiration=$1 WHERE userid=$2;",
      values: [expiration, userId],
    };
    ({ code, rows } = await performQuery(client, query));
    if (code != 200) {
      res
        .status(500)
        .write(JSON.stringify({ message: "There was an unexpected error. " }));
      next();
      return;
    }
  }

  res.status(200).write(
    JSON.stringify({
      clientId: retClientId,
      redirectUrl: redirectUrl,
      isUser: isUser,
      isAdmin: isAdmin,
    })
  );
  next();
};

export const sendResetPasswordEmail = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var email = req.body.email;

  // Lookup that the email entered is associated with an account.
  let query: QueryProps = {
    name: "LookupUserByEmail",
    text: "SELECT userid, username FROM users WHERE email=$1;",
    values: [email],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200 || rows.length === 0) {
    res.status(400);
    res.write(
      JSON.stringify({ message: "Couldn't find a user with that email" })
    );
    next();
    return;
  }

  // Generate a random UUID for the code and generate the expiration for 15
  // minutes in the future.
  var resetCode = uuidv4();
  var expiration = createMinuteExpiration(15);

  query = {
    name: "SetResetCode",
    text: "UPDATE users SET reset_code=$1, reset_expiration=$2 WHERE email=$3;",
    values: [resetCode, expiration, email],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: "Failed to set the reset code and expiration.",
      })
    );
    next();
    return;
  }

  // Send the email with the reset link.
  var link = `${process.env.SITE_URL}/reset_password?code=${resetCode}`;
  aws.config.update({
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    region: "us-west-2",
  });

  var emailParams = {
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: link,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "[login.etiennethompson.com] You requested to reset your password.",
      },
    },
    Source: "noreply@etiennethompson.com",
  };

  var ses = new aws.SES({ apiVersion: "2010-12-01" });
  await ses.sendEmail(emailParams, (err, data) => {
    if (err) {
      console.log(err);
    }
  });

  res.status(200);
  next();
  return;
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  const resetCode = req.body.resetCode;
  const newPassword = req.body.newPassword;

  const currentTime = getCurrentTimeField();

  let query: QueryProps = {
    name: "resetUserPassword",
    text: "UPDATE users SET password=$1, reset_code=NULL, reset_expiration=NULL WHERE reset_code=$2 AND reset_expiration>=$3",
    values: [newPassword, resetCode, currentTime],
  };
  const { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    res.status(400);
    res.write(
      JSON.stringify({
        message: "Couldn't reset your password. The code might have expired.",
      })
    );
    next();
    return;
  }

  res.status(200);
  next();
  return;
};

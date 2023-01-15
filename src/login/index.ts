import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import aws from "aws-sdk";
import { LoginRequest, ApplicationEntry, UserAdminStatus } from "./types";
import { UserEntry } from "../types";
import { QueryProps, DatabaseConnection } from "../utils/database";
import {
  createHourExpiration,
  createMinuteExpiration,
  getCurrentTimeField,
} from "../utils/date";
import {
  ErrorStatusCode,
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../utils/response";
import { User } from "../admin/types";

export const loginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
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
  let userRows: UserEntry[] = await client.PerformQuery(query);
  const entry = userRows[0];
  clientId = entry.clientid;
  userId = entry.userid;
  session_expiration = entry.session_expiration;

  // Verify the application exists and get the redirect url for that application.
  let redirectUrl: string = "";
  query = {
    name: "loginGetApplicationQuery",
    text: "SELECT redirecturl FROM applications WHERE applicationid=$1;",
    values: [reqBody.appid],
  };
  let redirectUrls: ApplicationEntry[] = await client.PerformQuery(query);
  for (let i = 0; i < redirectUrls.length; i++) {
    const entry = redirectUrls[i] as ApplicationEntry;
    if (entry.redirecturl.indexOf(reqBody.redirectBase)) {
      redirectUrl = entry.redirecturl;
      break;
    }
  }
  if (redirectUrl === "") {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.NotFound,
      "Could not find matching redirect url for given base."
    );
  }

  // Get the user, admin status for the given user for the given application.
  query = {
    name: "loginGetApplicationUsersQuery",
    text: "SELECT isuser, isadmin FROM applicationusers WHERE userid=$1 AND applicationid=$2",
    values: [userId, reqBody.appid],
  };
  let userStatus: UserAdminStatus[] = await client.PerformQuery(query);
  let isUser: boolean = false;
  let isAdmin: boolean = false;

  if (userStatus.length === 0) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.NotFound,
      "That user is not a member of the given application."
    );
  } else {
    isUser = userStatus[0].isuser;
    isAdmin = userStatus[0].isadmin;
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
      text: "UPDATE users SET clientid=$1, session_expiration=$2 WHERE userid=$3 RETURNING *;",
      values: [retClientId, expiration, userId],
    };
    await client.PerformQuery(query);
  } else {
    // Use the existing clientId.
    retClientId = clientId;
    const expiration = createHourExpiration();
    query = {
      text: "UPDATE users SET session_expiration=$1 WHERE userid=$2 RETURNING *;",
      values: [expiration, userId],
    };
    await client.PerformQuery(query);
  }

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    clientId: retClientId,
    redirectUrl: redirectUrl,
    isUser: isUser,
    isAdmin: isAdmin,
  });
};

export const sendResetPasswordEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  var email = req.body.email as string;

  // Lookup that the email entered is associated with an account.
  let query: QueryProps = {
    name: "LookupUserByEmail",
    text: "SELECT userid, username FROM users WHERE email=$1;",
    values: [email],
  };
  let response = await client.PerformQuery(query);
  if (response.length === 0) {
    return responseHelper.ErrorResponse(
      ErrorStatusCode.BadRequest,
      "Couldn't find a user with that email."
    );
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
  await client.PerformQuery(query);

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
      return responseHelper.ErrorResponse(
        ErrorStatusCode.BadRequest,
        "Failed to send the email."
      );
    }
  });

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const resetCode = req.body.resetCode as string;
  const newPassword = req.body.newPassword as string;

  const currentTime = getCurrentTimeField();

  let query: QueryProps = {
    name: "resetUserPassword",
    text: "UPDATE users SET password=$1, reset_code=NULL, reset_expiration=NULL WHERE reset_code=$2 AND reset_expiration>=$3 RETURNING user;",
    values: [newPassword, resetCode, currentTime],
  };
  await client.PerformQuery(query);
  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

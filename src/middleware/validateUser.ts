import { Request, Response, NextFunction } from "express";
import { ApplicationUser } from "../admin/types";
import { BaseRequest, UserEntry } from "../types";
import { QueryProps, DatabaseConnection } from "../utils/database";
import { getCurrentTimeField } from "../utils/date";
import { AuthenticationFailureReason, ResponseHelper } from "../utils/response";
import { closeDatabaseConnection } from "./closeDatabaseConnection";

export const validateUser = async (req: Request, res: Response, next: NextFunction) => {
  if (isValidationSkippedRoute(req)) {
    next();
    return;
  }
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;

  var reqBody = (req.body && req.body.clientid ? req.body : req.query) as BaseRequest;

  if (!reqBody.clientid || !reqBody.appid) {
    await closeDatabaseConnection(req);
    return responseHelper.Unauthorized(
      AuthenticationFailureReason.InvalidArguments,
      "You must provide both a Client ID and an Application ID to authenticate."
    );
  }

  // Validate that the given clientid is a user.
  let query: QueryProps = {
    name: "validateGetUserQuery",
    text: "SELECT userid, session_expiration FROM users WHERE clientid=$1;",
    values: [reqBody.clientid],
  };
  let userEntries: UserEntry[] = await client.PerformQuery(query);
  if (userEntries.length === 0) {
    await closeDatabaseConnection(req);
    return responseHelper.Unauthorized(
      AuthenticationFailureReason.InvalidClientId,
      "You are not a valid user of etiennethompson.com"
    );
  }

  // Validate that the clientid hasn't expired.
  let session_expiration = new Date(userEntries[0].session_expiration);
  let currentTime = new Date(getCurrentTimeField());
  let diff = session_expiration.getTime() - currentTime.getTime();
  if (diff < 0) {
    await closeDatabaseConnection(req);
    return responseHelper.Unauthorized(
      AuthenticationFailureReason.ExpiredSession,
      "Your session has expired. Please login again."
    );
  }

  let userid = userEntries[0].userid;

  query = {
    name: "validateGetApplicationQuery",
    text: "SELECT * FROM applications WHERE applicationid=$1;",
    values: [reqBody.appid],
  };
  let apps = await client.PerformQuery(query);

  if (apps.length === 0) {
    await closeDatabaseConnection(req);
    return responseHelper.Unauthorized(
      AuthenticationFailureReason.InvalidAppId,
      "That is not a valid application of etiennethompson.com"
    );
  }

  query = {
    name: "validateGetApplicationUsersQuery",
    text: "SELECT * FROM applicationusers WHERE applicationid=$1 AND userid=$2;",
    values: [reqBody.appid, userid],
  };
  let appUsers: ApplicationUser[] = await client.PerformQuery(query);

  if (appUsers.length === 0) {
    await closeDatabaseConnection(req);
    return responseHelper.Unauthorized(
      AuthenticationFailureReason.InvalidUser,
      "You are not a user of that application."
    );
  }

  req.body.isMock = !(appUsers[0].isuser || appUsers[0].isadmin);

  next();
};

function isValidationSkippedRoute(req: Request): boolean {
  return req.path.includes("login") || req.path.includes("etiennethompson");
}

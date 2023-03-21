import { v4 as uuidv4 } from "uuid";
import { IDatabaseConnection } from "../utils/database";
import { ResponseHelper } from "../utils/response";
import BaseRouteHandler from "./BaseRouteHandler";
import { LoginRequest, ApplicationEntry, UserAdminStatus } from "../login/types";
import { QueryProps } from "../utils/database";
import { UserEntry } from "../types";
import { SuccessfulStatusCode, ErrorStatusCode } from "../utils/response";
import { createHourExpiration } from "../utils/date";

class LoginHandler extends BaseRouteHandler {
  private database: IDatabaseConnection;
  private responseHelper: ResponseHelper;
  constructor(database: IDatabaseConnection, responseHelper: ResponseHelper) {
    super(responseHelper.req, responseHelper.next);
    this.database = database;
    this.responseHelper = responseHelper;
  }

  public async Login(): Promise<void> {
    this.HandleRequest(this.LoginInternal, this.LoginMock);
  }

  private LoginInternal = async (): Promise<void> => {
    var reqBody = this.responseHelper.req.body as LoginRequest;

    // Verify that the user exists and get the user's client id.
    let clientId: string = "";
    let userId: string = "";
    let session_expiration: string = "";
    let query: QueryProps = {
      name: "loginGetUserQuery",
      text: "SELECT clientid, userid, session_expiration FROM users WHERE username=$1 AND password=$2;",
      values: [reqBody.username, reqBody.hashedPassword],
    };
    let userRows: UserEntry[] = await this.database.PerformQuery(query);
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
    let redirectUrls: ApplicationEntry[] = await this.database.PerformQuery(query);
    for (let i = 0; i < redirectUrls.length; i++) {
      const entry = redirectUrls[i] as ApplicationEntry;
      if (entry.redirecturl.indexOf(reqBody.redirectBase)) {
        redirectUrl = entry.redirecturl;
        break;
      }
    }
    if (redirectUrl === "") {
      return this.responseHelper.ErrorResponse(
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
    let userStatus: UserAdminStatus[] = await this.database.PerformQuery(query);
    let isUser: boolean = false;
    let isAdmin: boolean = false;

    if (userStatus.length === 0) {
      return this.responseHelper.ErrorResponse(
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
      await this.database.PerformQuery(query);
    } else {
      // Use the existing clientId.
      retClientId = clientId;
      const expiration = createHourExpiration();
      query = {
        text: "UPDATE users SET session_expiration=$1 WHERE userid=$2 RETURNING *;",
        values: [expiration, userId],
      };
      await this.database.PerformQuery(query);
    }

    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
      clientId: retClientId,
      redirectUrl: redirectUrl,
      isUser: isUser,
      isAdmin: isAdmin,
    });
  };

  private LoginMock = async (): Promise<void> => {
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {});
    return Promise.resolve();
  };
}

export default LoginHandler;

import { v4 as uuidv4 } from "uuid";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { IDatabaseConnection } from "../utils/database";
import { ResponseHelper } from "../utils/response";
import BaseRouteHandler from "./BaseRouteHandler";
import {
  LoginRequest,
  ApplicationEntry,
  UserAdminStatus,
  PasskeyRegisterRequest,
  PasskeyLoginRequest,
} from "../login/types";
import { QueryProps } from "../utils/database";
import { UserEntry } from "../types";
import { HttpStatusCode, SuccessfulStatusCode, ErrorStatusCode } from "../utils/response";
import { createHourExpiration, createMinuteExpiration, getCurrentTimeField } from "../utils/date";
import { hashPassword, isLegacyPasswordHash, verifyPassword } from "../utils/password";
import {
  getExpectedOrigins,
  getRelyingPartyId,
  getRelyingPartyName,
  PasskeyChallengeEntry,
  PasskeyChallengePurpose,
  PasskeyCredentialEntry,
} from "../utils/webauthn";
import { SESEmailParameters } from "../types/aws";

type LoginResponseData = {
  clientId: string;
  redirectUrl: string;
  isUser: boolean;
  isAdmin: boolean;
};

type PasskeyRegistrationData = {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

class LoginHandler extends BaseRouteHandler {
  private database: IDatabaseConnection;
  private responseHelper: ResponseHelper;
  private aws: any;
  constructor(database: IDatabaseConnection, responseHelper: ResponseHelper, aws: any) {
    super(responseHelper.req, responseHelper.next);
    this.database = database;
    this.responseHelper = responseHelper;
    this.aws = aws;
  }

  public async Login(): Promise<void> {
    this.HandleRequest(this.LoginInternal, this.LoginMock);
  }

  public async SendResetPasswordEmail(): Promise<void> {
    this.HandleRequest(this.SendResetPasswordEmailInternal, this.SendResetPasswordEmailMock);
  }

  public async ChangePassword(): Promise<void> {
    this.HandleRequest(this.ChangePasswordInternal, this.ChangePasswordMock);
  }

  public async RegisterPasskey(): Promise<void> {
    this.HandleRequest(this.RegisterPasskeyInternal, this.RegisterPasskeyMock);
  }

  public async GetPasskeyLoginOptions(): Promise<void> {
    this.HandleRequest(this.GetPasskeyLoginOptionsInternal, this.GetPasskeyLoginOptionsMock);
  }

  public async PasskeyLogin(): Promise<void> {
    this.HandleRequest(this.PasskeyLoginInternal, this.PasskeyLoginMock);
  }

  private LoginInternal = async (): Promise<void> => {
    var reqBody = this.responseHelper.req.body as LoginRequest;

    // Verify that the user exists and that the password is correct.
    let query: QueryProps = {
      name: "loginGetUserQuery",
      text: "SELECT clientid, userid, username, password, session_expiration FROM users WHERE username=$1;",
      values: [reqBody.username],
    };
    let userRows: UserEntry[] = await this.database.PerformQuery(query);
    const user = userRows[0];
    if (!user || !(await verifyPassword(reqBody.hashedPassword, user.password))) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.Unauthorized, "Incorrect username or password.");
    }

    // Upgrade passwords stored before bcrypt hashing was added.
    if (isLegacyPasswordHash(user.password)) {
      query = {
        text: "UPDATE users SET password=$1 WHERE userid=$2;",
        values: [await hashPassword(reqBody.hashedPassword), user.userid],
      };
      await this.database.PerformQuery(query);
    }

    const loginData = await this.CompleteLogin(user, reqBody.appid, reqBody.redirectBase);
    if (!loginData) {
      return;
    }

    // A password login is a fresh proof of identity, so it's allowed to add a passkey.
    let passkeyRegistration: PasskeyRegistrationData | undefined = undefined;
    if (reqBody.includePasskeyRegistration) {
      passkeyRegistration = await this.CreatePasskeyRegistrationOptions(user);
    }

    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
      ...loginData,
      passkeyRegistration: passkeyRegistration,
    });
  };

  private RegisterPasskeyInternal = async (): Promise<void> => {
    const reqBody = this.responseHelper.req.body as PasskeyRegisterRequest;
    if (!reqBody.challengeId || !reqBody.credential) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "Missing passkey registration data.");
    }

    const challenge = await this.ConsumePasskeyChallenge(reqBody.challengeId, "registration");
    if (!challenge || !challenge.userid) {
      return this.responseHelper.ErrorResponse(
        ErrorStatusCode.BadRequest,
        "The passkey registration has expired. Please login again."
      );
    }

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: reqBody.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: getExpectedOrigins(),
        expectedRPID: getRelyingPartyId(),
      });
    } catch (error: any) {
      console.log(error);
      return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "Could not verify the passkey.");
    }

    if (!verification.verified) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "Could not verify the passkey.");
    }

    const credential = verification.registrationInfo.credential;
    const currentTime = getCurrentTimeField();
    const query: QueryProps = {
      name: "passkeyInsertCredential",
      text: "INSERT INTO passkey_credentials (credentialid, userid, public_key, sign_count, transports, created_at, last_used_at) VALUES ($1, $2, $3, $4, $5, $6, $6);",
      values: [
        credential.id,
        challenge.userid,
        Buffer.from(credential.publicKey).toString("base64url"),
        credential.counter,
        credential.transports ? credential.transports.join(",") : null,
        currentTime,
      ],
    };
    await this.database.PerformQuery(query);

    this.responseHelper.GenericResponse(HttpStatusCode.Created);
  };

  private GetPasskeyLoginOptionsInternal = async (): Promise<void> => {
    // Passkeys are discoverable, so no credentials are listed and the browser
    // lets the user pick any passkey they have for this site.
    const options = await generateAuthenticationOptions({
      rpID: getRelyingPartyId(),
      userVerification: "required",
    });
    const challengeId = await this.StorePasskeyChallenge(options.challenge, "authentication", null);

    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
      challengeId: challengeId,
      options: options,
    });
  };

  private PasskeyLoginInternal = async (): Promise<void> => {
    const reqBody = this.responseHelper.req.body as PasskeyLoginRequest;
    if (!reqBody.challengeId || !reqBody.credential) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "Missing passkey login data.");
    }

    const challenge = await this.ConsumePasskeyChallenge(reqBody.challengeId, "authentication");
    if (!challenge) {
      return this.responseHelper.ErrorResponse(
        ErrorStatusCode.Unauthorized,
        "The passkey login has expired. Please try again."
      );
    }

    let query: QueryProps = {
      name: "passkeyGetCredential",
      text: "SELECT credentialid, userid, public_key, sign_count, transports FROM passkey_credentials WHERE credentialid=$1;",
      values: [reqBody.credential.id],
    };
    const credentials: PasskeyCredentialEntry[] = await this.database.PerformQuery(query);
    const storedCredential = credentials[0];
    if (!storedCredential) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.Unauthorized, "That passkey is not registered.");
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: reqBody.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: getExpectedOrigins(),
        expectedRPID: getRelyingPartyId(),
        credential: {
          id: storedCredential.credentialid,
          publicKey: new Uint8Array(Buffer.from(storedCredential.public_key, "base64url")),
          counter: Number(storedCredential.sign_count),
          transports: storedCredential.transports ? storedCredential.transports.split(",") : undefined,
        },
      });
    } catch (error: any) {
      console.log(error);
      return this.responseHelper.ErrorResponse(ErrorStatusCode.Unauthorized, "Could not verify the passkey.");
    }

    if (!verification.verified) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.Unauthorized, "Could not verify the passkey.");
    }

    query = {
      name: "passkeyUpdateCredentialUsage",
      text: "UPDATE passkey_credentials SET sign_count=$1, last_used_at=$2 WHERE credentialid=$3;",
      values: [verification.authenticationInfo.newCounter, getCurrentTimeField(), storedCredential.credentialid],
    };
    await this.database.PerformQuery(query);

    query = {
      name: "passkeyGetUserQuery",
      text: "SELECT clientid, userid, username, session_expiration FROM users WHERE userid=$1;",
      values: [storedCredential.userid],
    };
    const userRows: UserEntry[] = await this.database.PerformQuery(query);

    const loginData = await this.CompleteLogin(userRows[0], reqBody.appid, reqBody.redirectBase);
    if (!loginData) {
      return;
    }

    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, loginData);
  };

  /**
   * Check the user's access to the application and start their session.
   * Sends an error response and returns undefined if the user can't login.
   * @param user The authenticated user.
   * @param appid The application the user is logging into.
   * @param redirectBase The base url to redirect the user back to.
   */
  private CompleteLogin = async (
    user: UserEntry,
    appid: string,
    redirectBase: string
  ): Promise<LoginResponseData | undefined> => {
    // Verify the application exists and get the redirect url for that application.
    let redirectUrl: string = "";
    let query: QueryProps = {
      name: "loginGetApplicationQuery",
      text: "SELECT redirecturl FROM applications WHERE applicationid=$1;",
      values: [appid],
    };
    let redirectUrls: ApplicationEntry[] = await this.database.PerformQuery(query);
    // Prefer the url matching the given base, otherwise use the application's
    // first url. The url always comes from the application, never the request.
    const matchingEntry = redirectUrls.find((entry) => entry.redirecturl.includes(redirectBase));
    if (matchingEntry) {
      redirectUrl = matchingEntry.redirecturl;
    } else if (redirectUrls.length > 0) {
      redirectUrl = redirectUrls[0].redirecturl;
    }
    if (redirectUrl === "") {
      this.responseHelper.ErrorResponse(
        ErrorStatusCode.NotFound,
        "Could not find matching redirect url for given base."
      );
      return undefined;
    }

    // Get the user, admin status for the given user for the given application.
    query = {
      name: "loginGetApplicationUsersQuery",
      text: "SELECT isuser, isadmin FROM applicationusers WHERE userid=$1 AND applicationid=$2",
      values: [user.userid, appid],
    };
    let userStatus: UserAdminStatus[] = await this.database.PerformQuery(query);
    let isUser: boolean = false;
    let isAdmin: boolean = false;

    if (userStatus.length === 0) {
      this.responseHelper.ErrorResponse(
        ErrorStatusCode.NotFound,
        "That user is not a member of the given application."
      );
      return undefined;
    } else {
      isUser = userStatus[0].isuser;
      isAdmin = userStatus[0].isadmin;
    }

    // Check if the user has a currently valid clientid, if they do, get that
    // and reset the session expiration.
    let diff = new Date(user.session_expiration).getTime() - new Date().getTime();
    let retClientId: string = "";
    if (diff < 0) {
      // Generate a new clientId for the user.
      retClientId = uuidv4();
      const expiration = createHourExpiration();
      query = {
        text: "UPDATE users SET clientid=$1, session_expiration=$2 WHERE userid=$3 RETURNING *;",
        values: [retClientId, expiration, user.userid],
      };
      await this.database.PerformQuery(query);
    } else {
      // Use the existing clientId.
      retClientId = user.clientid;
      const expiration = createHourExpiration();
      query = {
        text: "UPDATE users SET session_expiration=$1 WHERE userid=$2 RETURNING *;",
        values: [expiration, user.userid],
      };
      await this.database.PerformQuery(query);
    }

    return {
      clientId: retClientId,
      redirectUrl: redirectUrl,
      isUser: isUser,
      isAdmin: isAdmin,
    };
  };

  /**
   * Create the options the browser needs to register a new passkey for a user.
   * @param user The user who just logged in with their password.
   */
  private CreatePasskeyRegistrationOptions = async (user: UserEntry): Promise<PasskeyRegistrationData> => {
    // Exclude existing passkeys so the same authenticator isn't registered twice.
    const query: QueryProps = {
      name: "passkeyGetUserCredentials",
      text: "SELECT credentialid, transports FROM passkey_credentials WHERE userid=$1;",
      values: [user.userid],
    };
    const existingCredentials: PasskeyCredentialEntry[] = await this.database.PerformQuery(query);

    const options = await generateRegistrationOptions({
      rpName: getRelyingPartyName(),
      rpID: getRelyingPartyId(),
      userName: user.username,
      userID: new Uint8Array(Buffer.from(user.userid, "utf8")),
      attestationType: "none",
      excludeCredentials: existingCredentials.map((credential) => ({
        id: credential.credentialid,
        transports: credential.transports ? credential.transports.split(",") : undefined,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
    });
    const challengeId = await this.StorePasskeyChallenge(options.challenge, "registration", user.userid);

    return { challengeId: challengeId, options: options };
  };

  /**
   * Save a passkey challenge so it can be checked when the browser responds.
   * @returns The id the client sends back to identify the challenge.
   */
  private StorePasskeyChallenge = async (
    challenge: string,
    purpose: PasskeyChallengePurpose,
    userid: string | null
  ): Promise<string> => {
    // Clean up challenges that were never used.
    let query: QueryProps = {
      name: "passkeyDeleteExpiredChallenges",
      text: "DELETE FROM webauthn_challenges WHERE expiration<$1;",
      values: [getCurrentTimeField()],
    };
    await this.database.PerformQuery(query);

    const challengeId = uuidv4();
    query = {
      name: "passkeyInsertChallenge",
      text: "INSERT INTO webauthn_challenges (challengeid, challenge, purpose, userid, expiration) VALUES ($1, $2, $3, $4, $5);",
      values: [challengeId, challenge, purpose, userid, createMinuteExpiration(10)],
    };
    await this.database.PerformQuery(query);

    return challengeId;
  };

  /**
   * Remove a challenge so it can only be used once.
   * @returns The challenge, or undefined if it doesn't exist or has expired.
   */
  private ConsumePasskeyChallenge = async (
    challengeId: string,
    purpose: PasskeyChallengePurpose
  ): Promise<PasskeyChallengeEntry | undefined> => {
    const query: QueryProps = {
      name: "passkeyConsumeChallenge",
      text: "DELETE FROM webauthn_challenges WHERE challengeid=$1 AND purpose=$2 RETURNING challenge, userid, expiration>=$3 AS is_valid;",
      values: [challengeId, purpose, getCurrentTimeField()],
    };
    const challenges: PasskeyChallengeEntry[] = await this.database.PerformQuery(query);
    const challenge = challenges[0];
    if (!challenge || !challenge.is_valid) {
      return undefined;
    }

    return challenge;
  };

  private SendResetPasswordEmailInternal = async (): Promise<void> => {
    var email = this.responseHelper.req.body.email as string;

    // Lookup that the email entered is associated with an account.
    let query: QueryProps = {
      name: "LookupUserByEmail",
      text: "SELECT userid, username FROM users WHERE email=$1;",
      values: [email],
    };
    let response = await this.database.PerformQuery(query);
    if (response.length === 0) {
      return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "Couldn't find a user with that email.");
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
    await this.database.PerformQuery(query);

    // Send the email with the reset link.
    var link = `${process.env.SITE_URL}/reset_password?code=${resetCode}`;

    var emailParams: SESEmailParameters = {
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

    var ses = new this.aws.SES({ apiVersion: "2010-12-01" });
    await ses.sendEmail(emailParams, (err: any, data: any) => {
      if (err) {
        return this.responseHelper.ErrorResponse(ErrorStatusCode.BadRequest, "Failed to send the email.");
      }
    });

    this.responseHelper.GenericResponse(HttpStatusCode.Ok);
  };

  private ChangePasswordInternal = async () => {
    const resetCode = this.responseHelper.req.body.resetCode as string;
    const newPassword = this.responseHelper.req.body.newPassword as string;

    const currentTime = getCurrentTimeField();
    const hashedPassword = await hashPassword(newPassword);

    let query: QueryProps = {
      name: "resetUserPassword",
      text: "UPDATE users SET password=$1, reset_code=NULL, reset_expiration=NULL WHERE reset_code=$2 AND reset_expiration>=$3 RETURNING userid;",
      values: [hashedPassword, resetCode, currentTime],
    };
    const updatedUsers = await this.database.PerformQuery(query);
    if (updatedUsers.length === 0) {
      return this.responseHelper.ErrorResponse(
        ErrorStatusCode.BadRequest,
        "That reset link is invalid or has expired. Please request a new one."
      );
    }
    this.responseHelper.GenericResponse(HttpStatusCode.Ok);
  };

  private LoginMock = async (): Promise<void> => {
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {});
    return Promise.resolve();
  };

  private SendResetPasswordEmailMock = async (): Promise<void> => {
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {});
    return Promise.resolve();
  };

  private ChangePasswordMock = async () => {
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {});
    return Promise.resolve();
  };

  private RegisterPasskeyMock = async (): Promise<void> => {
    this.responseHelper.GenericResponse(HttpStatusCode.Created);
    return Promise.resolve();
  };

  private GetPasskeyLoginOptionsMock = async (): Promise<void> => {
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {});
    return Promise.resolve();
  };

  private PasskeyLoginMock = async (): Promise<void> => {
    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {});
    return Promise.resolve();
  };
}

export default LoginHandler;

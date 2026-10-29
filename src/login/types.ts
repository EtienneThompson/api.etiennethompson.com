import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

export type LoginRequest = {
  username: string;
  hashedPassword: string;
  appid: string;
  redirectBase: string;
  // When true, the response includes options for registering a new passkey.
  includePasskeyRegistration?: boolean;
};

export type ApplicationEntry = {
  applicationid: string;
  applicationname: string;
  redirecturl: string;
};

export type UserAdminStatus = {
  isuser: boolean;
  isadmin: boolean;
};

export type PasskeyRegisterRequest = {
  challengeId: string;
  // Not named "response" because req.body.response holds the ResponseHelper.
  credential: RegistrationResponseJSON;
};

export type PasskeyLoginRequest = {
  challengeId: string;
  credential: AuthenticationResponseJSON;
  appid: string;
  redirectBase: string;
};

export type LoginRequest = {
  username: string;
  hashedPassword: string;
  appid: string;
  redirectBase: string;
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

export type LoginRequest = {
  username: string;
  hashedPassword: string;
  appid: string;
};

export type UserEntry = {
  userid: string;
  username: string;
  password: string;
  clientid: string;
};

export type ApplicationEntry = {
  applicationid: string;
  applicationname: string;
  redirecturl: string;
};

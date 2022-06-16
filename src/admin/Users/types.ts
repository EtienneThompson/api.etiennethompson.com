export interface User {
  userid: string;
  username: string;
  hashedPassword: string;
  clientid: string;
  expiration: string;
}

export interface ReturnUser {
  userid: string;
  username: string;
  clientid: string;
}

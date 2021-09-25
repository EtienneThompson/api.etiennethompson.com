export interface QueryResponse {
  code: number;
  rows: any[];
}

export interface BaseRequest {
  clientid: string;
  appid: string;
}

export type UserEntry = {
  userid: string;
  username: string;
  password: string;
  clientid: string;
};

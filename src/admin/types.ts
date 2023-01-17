export interface TableNames {
  table_name: string;
}

export interface TableCount {
  count: string;
}

export interface TableNameCount {
  name: string;
  count: number;
}

export interface CountData {
  total: number;
  tables: TableNameCount[];
}

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
  email: string;
  clientid: string;
}

export interface Application {
  applicationid: string;
  applicationname: string;
  redirecturl: string;
}

export interface ReturnApp {
  applicationid: string;
  applicationname: string;
  redirecturl: string;
}

export interface ApplicationUser {
  userid: string;
  applicationid: string;
  isuser: boolean;
  isadmin: boolean;
}

export interface ReturnAppUser {
  user: string;
  application: string;
  isuser: boolean;
  isadmin: boolean;
}

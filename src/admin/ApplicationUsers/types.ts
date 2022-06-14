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

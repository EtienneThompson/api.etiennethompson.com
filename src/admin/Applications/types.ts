export interface Applications {
  applicationid: string;
  applicationname: string;
  redirecturl: string;
}

export interface CreateApplicationsRequest {
  applicationname: string;
  redirecturl: string;
}

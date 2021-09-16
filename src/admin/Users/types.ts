export interface Users {
  userid: string;
  username: string;
  hashedPassword: string;
  clientid: string;
}

export interface CreateRequestUsers {
  username: string;
  password: string;
}

export interface UpdateUserRequest {
  userid: string;
  username: string;
  hashedPassword: string;
}

export interface DeleteUserRequest {
  userid: string;
}

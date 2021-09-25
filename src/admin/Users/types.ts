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
  user: Users;
}

export interface DeleteUserRequest {
  userid: string;
}

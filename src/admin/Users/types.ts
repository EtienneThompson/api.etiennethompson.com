export interface CreateUserRequest {
  username: string;
  hashedPassword: string;
}

export interface UpdateUserRequest {
  userId: string;
  username: string;
  hashedPassword: string;
}

export interface DeleteUserRequest {
  userId: string;
}

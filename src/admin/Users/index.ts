import { Request, Response } from "express";

export const getUsers = (req: Request, res: Response) => {
  console.log("getting user information");
  res.send("getting user information");
};

export const createUser = (req: Request, res: Response) => {
  console.log("creating a user");
  res.send("creating a user");
};

export const updateUser = (req: Request, res: Response) => {
  console.log("updating a user");
  res.send("updating a user");
};

export const deleteUser = (req: Request, res: Response) => {
  console.log("deleting a user");
  res.send("deleting a user");
};

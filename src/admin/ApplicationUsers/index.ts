import { Request, Response } from "express";

export const getApplicationUsers = (req: Request, res: Response) => {
  console.log("getting application users");
  res.send("getting application users");
};

export const createApplicationUser = (req: Request, res: Response) => {
  console.log("creating application user");
  res.send("creating application user");
};

export const updateApplicationUser = (req: Request, res: Response) => {
  console.log("updating application user");
  res.send("updating application user");
};

export const deleteApplicationUser = (req: Request, res: Response) => {
  console.log("deleting application user");
  res.send("deleting application user");
};

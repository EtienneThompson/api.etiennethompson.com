import { Request, Response } from "express";

export const getApplications = (req: Request, res: Response): void => {
  console.log("admin get endpoint");
  res.send("admin get endpoint");
};

export const createApplication = (req: Request, res: Response) => {
  console.log("create new application");
  res.send("admin post endpoint");
};

export const updateApplication = (req: Request, res: Response) => {
  console.log("updating application");
  res.send("updating application");
};

export const deleteApplication = (req: Request, res: Response) => {
  console.log("deleting application");
  res.send("deleting application");
};

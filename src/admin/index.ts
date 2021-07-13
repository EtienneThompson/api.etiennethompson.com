import { Request, Response } from "express";

export const getApplicationInformation = (
  req: Request,
  res: Response
): void => {
  console.log("admin get endpoint");
  res.send("admin get endpoint");
};

export const createNewApplication = (req: Request, res: Response) => {
  console.log("create new application");
  res.send("admin post endpoint");
};

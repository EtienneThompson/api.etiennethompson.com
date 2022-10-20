import { Request, Response } from "express";

export const getClientDetails = (req: Request, res: Response, next: any) => {
  res.status(200);
  res.write("getClientDetails");
  next();
};

export const getNewClientSchema = (req: Request, res: Response, next: any) => {
  res.status(200);
  res.write("getNewClientSchema");
  next();
};

export const postNewClientDetails = (
  req: Request,
  res: Response,
  next: any
) => {
  res.status(200);
  res.write("postNewClientDetails");
  next();
};

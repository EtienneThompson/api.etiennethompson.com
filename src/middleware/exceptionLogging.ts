import { Request, Response, NextFunction } from "express";

export const exceptionLogging = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(err);
  res.status(500);
  res.write(JSON.stringify(err));
  next();
};

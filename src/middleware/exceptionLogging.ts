import { Request, Response } from "express";

export const exceptionLogging = (req: Request, res: Response, next: any) => {
  try {
    next();
  } catch (ex: any) {
    // TODO: upgrade this to store the error message somewhere.
    console.log(ex);
    res.status(500).send(ex);
    return;
  }
};

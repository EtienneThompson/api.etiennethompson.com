import { Request, Response, NextFunction } from "express";
import { ErrorStatusCode, ResponseHelper } from "../utils/response";

export const exceptionLogging = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(err);
  const responseHelper: ResponseHelper = req.body.response;
  responseHelper.ErrorResponse(ErrorStatusCode.InternalServerError, err);
};

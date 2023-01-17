import { Request, Response, NextFunction } from "express";
import { ErrorStatusCode, ResponseHelper } from "../utils/response";
import { DatabaseConnection } from "../utils/database";

export const exceptionLogging = async (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error to console.
  console.log(err);
  const client: DatabaseConnection = req.body.client;
  const awsClient: DatabaseConnection = req.body.awsClient;
  const responseHelper: ResponseHelper = req.body.response;

  // Rollback the database queries.
  await client.Rollback();
  if (awsClient) {
    await awsClient.Rollback();
  }

  responseHelper.ErrorResponse(ErrorStatusCode.InternalServerError, err);
};

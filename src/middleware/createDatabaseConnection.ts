import { Request, Response, NextFunction } from "express";
import { DatabaseConnection } from "../utils/database";
import { ResponseHelper } from "../utils/response";

export const createDatabaseConnection = async (req: Request, res: Response, next: NextFunction) => {
  if (req.url.includes("/thompsonaccounting")) {
    if (
      !process.env.THOMPSON_ACCOUNTING_DATABASE_HOST ||
      !process.env.THOMPSON_ACCOUNTING_DATABASE_USER ||
      !process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD ||
      !process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE
    ) {
      res.status(500).send({
        message: "Could not connect to database. Check the connection string.",
      });
      return;
    }

    const awsClient = new DatabaseConnection();
    await awsClient.Initialize(
      process.env.THOMPSON_ACCOUNTING_DATABASE_HOST,
      process.env.THOMPSON_ACCOUNTING_DATABASE_USER,
      process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD,
      process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE,
      5432
    );
    await awsClient.Begin();
    req.body.awsClient = awsClient;
  }

  if (!process.env.DATABASE_URL) {
    res.status(500).send({
      message: "Could not connect to database. Check the connection string.",
    });
    return;
  }

  const client = new DatabaseConnection();
  await client.InitializeByConnectionString(process.env.DATABASE_URL);
  await client.Begin();
  req.body.client = client;

  const responseHelper = new ResponseHelper(req, res, next);
  req.body.response = responseHelper;

  res.type("json");
  next();
};

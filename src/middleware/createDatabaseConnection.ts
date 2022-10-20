import { Request, Response } from "express";
import { connectToDatabase, connectToAWSDatabase } from "../utils/database";

export const createDatabaseConnection = async (
  req: Request,
  res: Response,
  next: any
) => {
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

    const awsClient = await connectToAWSDatabase(
      process.env.THOMPSON_ACCOUNTING_DATABASE_HOST,
      process.env.THOMPSON_ACCOUNTING_DATABASE_USER,
      process.env.THOMPSON_ACCOUNTING_DATABASE_PASSWORD,
      process.env.THOMPSON_ACCOUNTING_DATABASE_DATABASE
    );
    req.body.awsClient = awsClient;
  }

  if (!process.env.DATABASE_URL) {
    res.status(500).send({
      message: "Could not connect to database. Check the connection string.",
    });
    return;
  }

  const client = await connectToDatabase(process.env.DATABASE_URL);

  req.body.client = client;
  res.type("json");
  next();
};

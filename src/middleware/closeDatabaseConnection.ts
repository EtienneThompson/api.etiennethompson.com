import { Request, Response } from "express";
import { Client } from "pg";
import { DatabaseConnection } from "../utils/database";

const closeDatabaseConnectionInternal = async (req: Request) => {
  const client: DatabaseConnection = req.body.client;
  await client.Close();

  if (req.body.awsClient) {
    const awsClient: Client = req.body.awsClient;
    await awsClient.end();
  }
};

export const closeDatabaseConnection = async (req: Request) => {
  await closeDatabaseConnectionInternal(req);
};

export const closeDatabaseConnectionMiddleware = async (
  req: Request,
  res: Response,
  next: any
) => {
  await closeDatabaseConnectionInternal(req);
  res.end();
};

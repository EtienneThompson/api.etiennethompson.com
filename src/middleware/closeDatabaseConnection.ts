import { Request, Response } from "express";
import { Client } from "pg";

export const closeDatabaseConnection = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client: Client = req.body.client;

  if (req.body.awsClient) {
    const awsClient: Client = req.body.awsClient;
    await awsClient.end();
  }

  await client.end();
  res.end();
};

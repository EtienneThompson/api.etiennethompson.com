import { Request, Response } from "express";

export const closeDatabaseConnection = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  await client.end();
  res.end();
};

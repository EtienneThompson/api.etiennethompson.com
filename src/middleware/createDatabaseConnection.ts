import { Request, Response } from "express";
import { connectToDatabase } from "../utils/database";

export const createDatabaseConnection = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = await connectToDatabase();
  req.body.client = client;
  next();
};

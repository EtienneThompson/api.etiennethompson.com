import { Request, Response } from "express";
import { QueryProps, DatabaseConnection } from "../../utils/database";
import { TableNames, TableCount, CountData } from "./types";

/**
 * Gets the count of all database tables.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 * @returns void
 */
export const getTableCounts = async (
  req: Request,
  res: Response,
  next: any
): Promise<void> => {
  const client = req.body.client as DatabaseConnection;
  // Query for all database table names in the database.
  let query: QueryProps = {
    name: "getTableNames",
    text: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';",
    values: [],
  };
  let response = await client.PerformQuery(query);
  if (response.code != 200) {
    res.status(404);
    next();
    return;
  }

  let tables: TableNames[] = response.rows;

  let total = 0;
  let data: CountData = {
    total: 0,
    tables: [],
  };

  // Count entries for all the database tables.
  for (let table of tables) {
    query = {
      text: `SELECT COUNT(*) FROM ${table.table_name}`,
      values: [],
    };
    response = await client.PerformQuery(query);
    if (response.code == 200) {
      let count: TableCount = response.rows[0];
      let countNum = parseInt(count.count);
      total += countNum;
      data.tables.push({ name: table.table_name, count: countNum });
    }
  }
  data.total = total;

  res.status(200).write(JSON.stringify(data));
  next();
};

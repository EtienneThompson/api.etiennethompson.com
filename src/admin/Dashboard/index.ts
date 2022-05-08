import { Request, Response } from "express";
import { QueryProps, performQuery } from "../../utils/database";
import { TableNames, TableCount, CountData } from "./types";

export const getTableCounts = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  let query: QueryProps = {
    name: "getTableNames",
    text: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';",
    values: [],
  };
  let { code, rows } = await performQuery(client, query);
  if (code != 200) {
    res.status(404);
    next();
    return;
  }

  let tables: TableNames[] = rows;

  let total = 0;
  let data: CountData = {
    total: 0,
    tables: [],
  };

  for (let table of tables) {
    query = {
      text: `SELECT COUNT(*) FROM ${table.table_name}`,
      values: [],
    };
    ({ code, rows } = await performQuery(client, query));
    if (code == 200) {
      let count: TableCount = rows[0];
      let countNum = parseInt(count.count);
      total += countNum;
      data.tables.push({ name: table.table_name, count: countNum });
    }
  }
  data.total = total;

  res.status(200);
  res.write(JSON.stringify(data));
  next();
};

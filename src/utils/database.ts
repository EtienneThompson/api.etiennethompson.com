import { Client } from "pg";
import { QueryResponse } from "../types";

/**
 * TODO: Perform the query, retrying on failed database connections.
 * @param client the database to perform the query on.
 * @param query the query to perform.
 * @returns the results of the query, undefined if no results, and null if no response.
 */
export const performQuery = async (query: string): Promise<QueryResponse> => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();
  const { code, rows } = await makeSingleQuery(client, query);
  await client.end();

  return { code, rows };
};

/**
 * Makes a single query and returns the results if there were any.
 * @param client the database to perform the query on.
 * @param query the query to perform.
 * @returns the results of the query, undefined if no results, and null if no response.
 */
const makeSingleQuery = async (
  client: Client,
  query: string
): Promise<QueryResponse> => {
  const response = await client.query(query);

  if (response) {
    if (response.rowCount > 0 && response.rows.length > 0) {
      return { code: 200, rows: response.rows } as QueryResponse;
    } else if (response.rowCount > 0 && response.rows.length === 0) {
      return { code: 200, rows: [] } as QueryResponse;
    } else {
      return { code: 400, rows: [] } as QueryResponse;
    }
  } else {
    return { code: 500, rows: [] } as QueryResponse;
  }
};

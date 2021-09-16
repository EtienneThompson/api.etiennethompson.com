import { Client } from "pg";
import { QueryResponse } from "../types";

/**
 * Connect to the database and return a client object for further interactions.
 * @returns Client object for interacting with the database.
 */
export const connectToDatabase = (): Client => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  client.connect();

  return client;
};

/**
 * TODO: Perform the query, retrying on failed database connections.
 * @param client the database to perform the query on.
 * @param query the query to perform.
 * @returns the results of the query, undefined if no results, and null if no response.
 */
export const performQuery = async (
  client: Client,
  query: string
): Promise<QueryResponse> => {
  return await makeSingleQuery(client, query);
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

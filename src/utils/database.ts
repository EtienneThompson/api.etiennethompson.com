import { Client } from "pg";
import { QueryResponse } from "../types";

export const connectToDatabase = async (
  connectionString: string
): Promise<Client> => {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  return client;
};

export const connectToAWSDatabase = async (
  host: string,
  username: string,
  password: string,
  database: string,
  port: number = 5432
): Promise<Client> => {
  const client = new Client({
    host: host,
    user: username,
    password: password,
    database: database,
    port: port,
  });

  await client.connect();

  return client;
};

export interface QueryProps {
  name?: string;
  text: string;
  values: (string | boolean)[];
}

/**
 * TODO: Perform the query, retrying on failed database connections.
 * @param client the database to perform the query on.
 * @param query the query to perform.
 * @returns the results of the query, undefined if no results, and null if no response.
 */
export const performQuery = async (
  client: Client,
  query: QueryProps
): Promise<QueryResponse> => {
  const { code, rows } = await makeSingleQuery(client, query);
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
  query: QueryProps
): Promise<QueryResponse> => {
  try {
    const response = await client.query(query);
    return { code: 200, rows: response.rows } as QueryResponse;
  } catch (error) {
    return { code: 400, rows: [] } as QueryResponse;
  }
};

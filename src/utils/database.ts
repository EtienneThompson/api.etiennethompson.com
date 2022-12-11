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
 * Gets a user's id based on their clientid for future database interactions.
 * @param client The database client used to query.
 * @param clientid The client id that is passed to the API endpoint.
 * @returns The userid for that client id if it exists.
 */
export const getUserId = async (
  client: any,
  clientid: string
): Promise<string> => {
  let query: QueryProps = {
    name: "inventoryGetUserIdQuery",
    text: "SELECT userid FROM users WHERE clientid=$1;",
    values: [clientid],
  };
  let { code, rows } = await performQuery(client, query);
  // The client id was verified in middleware, so this should always return a value.
  return rows[0].userid as string;
};

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

export const performFormattedQuery = async (
  client: Client,
  sql: string
): Promise<QueryResponse> => {
  return await makeSingleQuery(client, sql);
};

/**
 * Makes a single query and returns the results if there were any.
 * @param client the database to perform the query on.
 * @param query the query to perform.
 * @returns the results of the query, undefined if no results, and null if no response.
 */
const makeSingleQuery = async (
  client: Client,
  query: QueryProps | string
): Promise<QueryResponse> => {
  try {
    const response = await client.query(query);
    return { code: 200, rows: response.rows } as QueryResponse;
  } catch (error) {
    return { code: 400, rows: [] } as QueryResponse;
  }
};

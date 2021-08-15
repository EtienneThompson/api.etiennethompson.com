import { Client } from "pg";

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

export const performQuery = async (client: Client, query: string) => {
  return await makeSingleQuery(client, query);
};

/**
 * Makes a single query and returns the results if there were any.
 * @param client the database to perform the query on.
 * @param query the query to perform.
 * @returns The results of the query, undefined if no results, and null if no response.
 */
const makeSingleQuery = async (
  client: Client,
  query: string
): Promise<any[] | undefined | null> => {
  const response = await client.query(query);

  if (response) {
    if (response.rows.length === 0) {
      return undefined;
    } else {
      return response.rows;
    }
  } else {
    return null;
  }
};

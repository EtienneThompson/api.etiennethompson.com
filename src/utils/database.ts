import { Client } from "pg";
import { QueryResponse } from "../types";

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
  try {
    const response = await client.query(query);
    return { code: 200, rows: response.rows } as QueryResponse;
  } catch (error) {
    return { code: 400, rows: [] } as QueryResponse;
  }
};

export interface QueryProps {
  name?: string;
  text: string;
  values: (string | boolean | number)[];
}

export class DatabaseConnection {
  client: Client | undefined;
  isOpen: boolean;

  constructor() {
    this.client = undefined;
    this.isOpen = false;
  }

  public async Initialize(
    host: string,
    username: string,
    password: string,
    database: string,
    port: number
  ): Promise<void> {
    this.client = new Client({
      host: host,
      user: username,
      password: password,
      database: database,
      port: port,
    });

    await this.Connect();
  }

  public async InitializeByConnectionString(
    connectionString: string
  ): Promise<void> {
    this.client = new Client({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    await this.Connect();
    this.isOpen = true;
  }

  public async Connect(): Promise<void> {
    if (this.client === undefined) {
      throw new Error("The client wasn't initialized.");
    }

    await this.client.connect();
    this.isOpen = true;
  }

  public async Close(): Promise<void> {
    if (this.client === undefined || !this.isOpen) {
      throw new Error("The client wasn't initialized.");
    }

    await this.client.end();
    this.isOpen = false;
  }

  public GetClient(): Client {
    if (this.client === undefined) {
      throw new Error("The client wasn't initialized.");
    }

    return this.client;
  }

  public async Begin(): Promise<void> {
    await this.MakeSingleQuery("BEGIN");
  }

  public async PerformQuery(query: QueryProps): Promise<QueryResponse> {
    const response = await this.MakeSingleQuery(query);
    return response;
  }

  public async PerformFormattedQuery(query: string): Promise<QueryResponse> {
    const response = await this.MakeSingleQuery(query);
    return response;
  }

  public async GetUserId(clientid: string): Promise<string | null> {
    let query: QueryProps = {
      name: "inventoryGetUserIdQuery",
      text: "SELECT userid FROM users WHERE clientid=$1;",
      values: [clientid],
    };
    let response = await this.MakeSingleQuery(query);
    if (response.code !== 200 || response.rows.length === 0) {
      return null;
    }
    // The client id was verified in middleware, so this should always return a value.
    return response.rows[0].userid as string;
  }

  public async Commit(): Promise<void> {
    await this.MakeSingleQuery("COMMIT");
  }

  public async Rollback(): Promise<void> {
    await this.MakeSingleQuery("ROLLBACK");
  }

  private async MakeSingleQuery(
    query: QueryProps | string
  ): Promise<QueryResponse> {
    // Don't make the query if the client wasn't initialized or if the client
    // connection has already been closed.
    if (this.client === undefined || !this.isOpen) {
      throw new Error("The client wasn't initialized.");
    }

    try {
      const response = await this.client.query(query);
      return { code: 200, rows: response.rows } as QueryResponse;
    } catch (error) {
      throw error;
    }
  }
}

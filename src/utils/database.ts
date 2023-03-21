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

export interface IDatabaseConnection {
  Connect(): Promise<void>;
  Close(): Promise<void>;
  Begin(): Promise<void>;
  Commit(): Promise<void>;
  Rollback(): Promise<void>;
  PerformQuery(query: QueryProps): Promise<any[]>;
  PerformFormattedQuery(query: string): Promise<any[]>;
}

export class DatabaseConnection implements IDatabaseConnection {
  client: Client | undefined;
  isFinished: boolean;
  isOpen: boolean;

  constructor() {
    this.client = undefined;
    this.isOpen = false;
    this.isFinished = false;
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
    this.isFinished = true;
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

  public async PerformQuery(query: QueryProps): Promise<any[]> {
    return await this.MakeSingleQuery(query);
  }

  public async PerformFormattedQuery(query: string): Promise<any[]> {
    return await this.MakeSingleQuery(query);
  }

  public async GetUserId(clientid: string): Promise<string> {
    let query: QueryProps = {
      name: "inventoryGetUserIdQuery",
      text: "SELECT userid FROM users WHERE clientid=$1;",
      values: [clientid],
    };
    let rows = await this.MakeSingleQuery(query);
    // The client id was verified in middleware, so this should always return a value.
    return rows[0].userid as string;
  }

  public async Commit(): Promise<void> {
    if (!this.isFinished) {
      await this.MakeSingleQuery("COMMIT");
      this.isFinished = true;
    }
  }

  public async Rollback(): Promise<void> {
    if (!this.isFinished) {
      await this.MakeSingleQuery("ROLLBACK");
      this.isFinished = true;
    }
  }

  private async MakeSingleQuery(query: QueryProps | string): Promise<any[]> {
    // Don't make the query if the client wasn't initialized or if the client
    // connection has already been closed.
    if (this.client === undefined || !this.isOpen) {
      throw new Error("The client wasn't initialized.");
    }

    try {
      const response = await this.client.query(query);
      return response.rows;
    } catch (error) {
      throw error;
    }
  }
}

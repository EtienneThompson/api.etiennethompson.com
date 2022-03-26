import { Client } from "pg";
import { QueryResponse } from "../types";

// validateUser
const validateGetUserQuery = "SELECT * FROM users WHERE clientid='$1';";
const validateGetApplicationQuery =
  "SELECT * FROM applications WHERE applicationid='$1';";
const validateGetApplicationUserQuery =
  "SELECT * FROM applicationusers WHERE userid='$1' AND userid='$1';";
// login
const loginGetUserQuery =
  "SELECT * FROM users WHERE username='$1' AND password='$2';";
const loginGetApplicationQuery =
  "SELECT * FROM applications WHERE applicationid='$1';";
const loginGetApplicationUserQuery =
  "SELECT isuser, isadmin FROM applicationusers WHERE userid='$1'";
const loginUpdateClientAndSessionQuery =
  "UPDATE users SET clientid='$1', session_expiration='$2' WHERE userid='$3';";
// admin/users
const adminGetUsersQuery = "SELECT * FROM users;";
const adminInsertUsersQuery =
  "INSERT INTO users (userid, username, password, clientid, session_expiration) VALUES ('$1', '$2', '$3', '$4', '$5');";
const adminUpdateUsersQuery =
  "UPDATE users SET username='$1' WHERE userid='$2';";
const adminDeleteUsersQuery = "DELETE FROM users WHERE userid='$1';";
// admin/applications
const adminGetApplicationsQuery = "SELECT * FROM applications;";
const adminInsertApplicationsQuery =
  "INSERT INTO applications (applicationid, applicationname, redirecturl) VALUES ('$1', '$2', '$3');";
const adminUpdateApplicationsQuery =
  "UPDATE applications SET applicationname='$1', redirecturl='$2' WHERE applicationid='$3';";
const adminDeleteApplicationsQuery =
  "DELETE FROM applications WHERE applicationid='$1';";
// admin/applicationusers
const adminGetApplicationUsersQuery = "SELECT * FROM applicationusers;";
const adminInsertApplicationUsersQuery =
  "INSERT INTO applicationusers (userid, applicationid, isuser, isadmin) VALUES ('$1', '$2', '$3', '$4');";
const adminUpdateApplicationUsersQuery =
  "UPDATE applicationusers SET isuser='$1', isadmin='$2' WHERE userid='$3' AND applicationid='$4';";
const adminDeleteApplicationUsersQuery =
  "DELETE FROM applicationusers WHERE userid='$1' AND applicationid='$2';";
// inventory
const inventoryGetUserIdQuery =
  "SELECT userid FROM users WHERE clientid='$1';";
const inventoryGetBaseFolderQuery =
  "SELECT folderid, name, picture FROM folders WHERE owner='$1' AND parent_folder is null;";
const inventoryGetFolderQuery =
  "SELECT folderid, name, picture, description, parent_folder, created, updated FROM folders WHERE folderid='$1' AND owner='$2';";
const inventoryGetFolderChildrenQuery =
  "SELECT folderid, name, picture FROM folders WHERE parent_folder='$1' AND owner='$2';";
const inventoryGetItemChildrenQuery =
  "SELECT itemid, name, picture FROM items WHERE parent_folder='$1' AND owner='$2';";
const inventoryGetItemQuery =
  "SELECT itemid, name, picture, description, parent_folder, created, updated FROM items WHERE itemid='$1' AND owner='$2';";
const inventoryInsertFolderQuery =
  "INSERT INTO folders (folderid, name, description, picture, owner, parent_folder, created, updated) VALUES ('$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8');";
const inventoryInsertItemQuery =
  "INSERT INTO items (itemid, name, description, picture, owner, parent_folder, created, updated) VALUES ('$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8');";
const inventoryGetCurrentFolderPictureQuery =
  "SELECT picture FROM folders WHERE folderid='$1' AND owner='$2';";
const inventoryUpdateFolderWithImageQuery =
  "UPDATE folders SET name='$1', description='$2', picture='$3', updated='$4' WHERE folderid='$5' AND owner='$6';";
const inventoryUpdateFolderQuery =
  "UPDATE folders SET name='$1', description='$2', updated='$3' WHERE folderid='$4' AND owner='$5';";
const inventoryGetCurrentItemPictureQuery =
  "SELECT picture FROM items WHERE itemid='$1' AND owner='$2';";
const inventoryUpdateItemWithImageQuery =
  "UPDATE items SET name='$1', description='$2', picture='$3', updated='$4' WHERE itemid='$5' AND owner='$6';";
const inventoryUpdateItemQuery =
  "UPDATE items SET name='$1', description='$2', updated='$3' WHERE itemid='$4' AND owner='$5';";
const inventoryDeleteFolderQuery =
  "DELETE FROM folders WHERE folderid='$1' AND owner='$2';";
const inventoryDeleteItemQuery =
  "DELETE FROM items WHERE itemid='$1' AND owner='$2';";

export const connectToDatabase = async (): Promise<Client> => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

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

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { performQuery } from "../utils/database";
import { getCurrentTimeField } from "../utils/date";
import { CreateRequest } from "./types";

const getUserId = async (client: any, clientid: string): Promise<string> => {
  const getUserIdQuery = `SELECT userid FROM users WHERE clientid='${clientid}'`;
  let { code, rows } = await performQuery(client, getUserIdQuery);
  // The client id was verified in middleware, so this should always return a value.
  return rows[0].userid as string;
};

export const getFolder = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  let params = req.query;
  let userid = await getUserId(client, params.clientid as string);
  const getFolderQuery = `SELECT folderid, name, picture, description, parent_folder, created, updated FROM folders WHERE folderid='${params.folderid}' AND owner='${userid}'`;
  let { code, rows } = await performQuery(client, getFolderQuery);
  if (code !== 200) {
    res.status(404);
    res.write(JSON.stringify({ message: "That folder was not found." }));
    return;
  }
  let folderInfo = rows[0];

  const getFolderChildrenQuery = `SELECT folderid, name, picture FROM folders WHERE parent_folder='${params.folderid}' AND owner='${userid}'`;
  const getItemChildrenQuery = `SELECT itemid, name, picture FROM items WHERE parent_folder='${params.folderid}' AND owner='${userid}'`;
  ({ code, rows } = await performQuery(client, getFolderChildrenQuery));
  let children: any[] = [];
  if (code === 200) {
    let folderChildren = rows.map((child) => {
      child.type = "folder";
      child.id = child.folderid;
      return child;
    });
    children = children.concat(folderChildren);
  }
  ({ code, rows } = await performQuery(client, getItemChildrenQuery));
  if (code === 200) {
    let itemChildren = rows.map((child) => {
      child.type = "item";
      child.id = child.itemid;
      return child;
    });
    children = children.concat(itemChildren);
  }
  folderInfo.children = children;
  res.status(200);
  res.write(JSON.stringify({ folder: folderInfo }));
  next();
};

export const getItem = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  let params = req.query;
  let userid = await getUserId(client, params.clientid as string);
  const getItemQuery = `SELECT itemid, name, picture, description, parent_folder, created, updated FROM items WHERE itemid='${params.itemid}' AND owner='${userid}'`;
  let { code, rows } = await performQuery(client, getItemQuery);
  if (code !== 200) {
    res.status(404);
    res.write(JSON.stringify({ message: "That item was not found." }));
    return;
  }
  let itemInfo = rows[0];
  res.status(200);
  res.write(JSON.stringify({ item: itemInfo }));
  next();
};

export const createFolder = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // insert into folders (folderid, name, description, owner, picture, parent_folder, created, updated) VALUES (...);
  const newFolder = req.body.newElement as CreateRequest;
  const clientid = req.body.clientid;

  let userid = await getUserId(client, clientid);
  let newFolderId = uuidv4();
  let currentTime = getCurrentTimeField();

  const createFolderQuery = `INSERT INTO folders (folderid, name, description, picture, owner, parent_folder, created, updated) VALUES ('${newFolderId}', '${newFolder.name}', '${newFolder.description}', '${newFolder.picture}', '${userid}', '${newFolder.parent_folder}', '${currentTime}', '${currentTime}');`;
  let { code, rows } = await performQuery(client, createFolderQuery);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdElement: {
          id: newFolderId,
          name: newFolder.name,
          picture: newFolder.picture,
          type: "folder",
        },
      })
    );
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "Folder failed to be created." }));
  }
  next();
};

export const createItem = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // insert into items (itemid, name, description, picture, owner, parent_folder, created, updated) VALUES (...);
  const newItem = req.body.newElement as CreateRequest;
  const clientid = req.body.clientid as string;

  let userid = await getUserId(client, clientid);
  let newItemId = uuidv4();
  let currentTime = getCurrentTimeField();

  const createItemQuery = `INSERT INTO items (itemid, name, description, picture, owner, parent_folder, created, updated) VALUES ('${newItemId}', '${newItem.name}', '${newItem.description}', '${newItem.picture}', '${userid}', '${newItem.parent_folder}', '${currentTime}', '${currentTime}');`;
  let { code, rows } = await performQuery(client, createItemQuery);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdElement: {
          id: newItemId,
          name: newItem.name,
          picture: newItem.picture,
          type: "item",
        },
      })
    );
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "Item failed to be created." }));
  }
  next();
};

export const updateFolder = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  const clientid: string = req.body.clientid;
  var reqBody = req.body.data;

  let userid = await getUserId(client, clientid);
  const updateFolderQuery = `UPDATE folders SET name='${reqBody.name}', description='${reqBody.description}', picture='${reqBody.picture}' WHERE folderid='${reqBody.id}' AND owner='${userid}'`;
  const { code, rows } = await performQuery(client, updateFolderQuery);

  res.status(code);
  next();
};

export const updateItem = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  const clientid: string = req.body.clientid;
  var reqBody = req.body.data;

  let userid = await getUserId(client, clientid);
  const updateItemQuery = `UPDATE items SET name='${reqBody.name}', description='${reqBody.description}', picture='${reqBody.picture}' WHERE itemid='${reqBody.id}' AND owner='${userid}'`;
  const { code, rows } = await performQuery(client, updateItemQuery);

  res.status(code);
  next();
};

export const deleteFolder = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // delete from folders where folderid='${folderid}' and owner='${userid}'
  const folderid: string = req.body.folderid;
  const clientid: string = req.body.clientid;

  let userid = await getUserId(client, clientid);
  const deleteFolderQuery = `DELETE FROM folders WHERE folderid='${folderid}' AND owner='${userid}';`;
  const { code, rows } = await performQuery(client, deleteFolderQuery);

  if (code === 200) {
    res.status(200);
    res.write(JSON.stringify({ message: "Folder was successfully deleted." }));
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "Failed to delete folder." }));
  }
  next();
};

export const deleteItem = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  const itemid: string = req.body.itemid;
  const clientid: string = req.body.clientid;

  let userid = await getUserId(client, clientid);
  const deleteItemQuery = `DELETE FROM items WHERE itemid='${itemid}' AND owner='${userid}';`;
  const { code, rows } = await performQuery(client, deleteItemQuery);

  if (code === 200) {
    res.status(200);
    res.write(JSON.stringify({ message: "Item was successfully deleted." }));
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "Failed to delete item." }));
  }
  next();
};

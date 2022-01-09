import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { performQuery } from "../utils/database";
import { getCurrentTimeField } from "../utils/date";
import { CreateFolderRequest } from "./types";

const getUserId = async (clientid: string): Promise<string> => {
  const getUserIdQuery = `SELECT userid FROM users WHERE clientid='${clientid}'`;
  let { code, rows } = await performQuery(getUserIdQuery);
  // The client id was verified in middleware, so this should always return a value.
  return rows[0].userid as string;
};

export const getFolder = async (req: Request, res: Response) => {
  let params = req.query;
  let userid = await getUserId(params.clientid as string);
  const getFolderQuery = `SELECT folderid, name, picture, description, parent_folder, created, updated FROM folders WHERE folderid='${params.folderid}' AND owner='${userid}'`;
  let { code, rows } = await performQuery(getFolderQuery);
  if (code !== 200) {
    res.status(404);
    res.send({ message: "That folder was not found." });
    return;
  }
  let folderInfo = rows[0];

  const getFolderChildrenQuery = `SELECT folderid, name, picture FROM folders WHERE parent_folder='${params.folderid}' AND owner='${userid}'`;
  const getItemChildrenQuery = `SELECT itemid, name, picture FROM items WHERE parent_folder='${params.folderid}' AND owner='${userid}'`;
  ({ code, rows } = await performQuery(getFolderChildrenQuery));
  let children: any[] = [];
  if (code === 200) {
    let folderChildren = rows.map((child) => {
      child.type = "folder";
      child.id = child.folderid;
      return child;
    });
    children = children.concat(folderChildren);
  }
  ({ code, rows } = await performQuery(getItemChildrenQuery));
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
  res.send({ folder: folderInfo });
};

export const getItem = async (req: Request, res: Response) => {
  let params = req.query;
  let userid = await getUserId(params.clientid as string);
  const getItemQuery = `SELECT itemid, name, picture, description, parent_folder, created, updated FROM items WHERE itemid='${params.itemid}' AND owner='${userid}'`;
  let { code, rows } = await performQuery(getItemQuery);
  if (code !== 200) {
    res.status(404);
    res.send({ message: "That item was not found." });
    return;
  }
  let itemInfo = rows[0];
  res.status(200);
  res.send({ item: itemInfo });
};

export const createFolder = async (req: Request, res: Response) => {
  // insert into folders (folderid, name, description, owner, picture, parent_folder, created, updated) VALES (...);
  const newFolder = req.body.newElement as CreateFolderRequest;
  const clientid = req.body.clientid;

  let userid = await getUserId(clientid);
  let newFolderId = uuidv4();
  let currentTime = getCurrentTimeField();

  const createFolderQuery = `INSERT INTO folders (folderid, name, description, picture, owner, parent_folder, created, updated) VALUES ('${newFolderId}', '${newFolder.name}', '${newFolder.description}', '${newFolder.picture}', '${userid}', '${newFolder.parent_folder}', '${currentTime}', '${currentTime}');`;
  let { code, rows } = await performQuery(createFolderQuery);

  if (code === 200) {
    res.status(200);
    res.send({ message: "Folder created successfully." });
  } else {
    res.status(500);
    res.send({ message: "Folder failed to be created." });
  }
};

export const createItem = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "createItem endpoint" });
};

export const updateFolder = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "updateFolder endpoint" });
};

export const updateItem = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "updateItem endpoint" });
};

export const deleteFolder = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "deleteFolder endpoint" });
};

export const deleteItem = async (req: Request, res: Response) => {
  res.status(200);
  res.send({ message: "deleteItem endpoint" });
};

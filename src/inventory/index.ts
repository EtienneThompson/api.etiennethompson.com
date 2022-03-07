import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import aws from "aws-sdk";
import { performQuery } from "../utils/database";
import { getCurrentTimeField } from "../utils/date";
import { CreateRequest } from "./types";

const getUserId = async (client: any, clientid: string): Promise<string> => {
  const getUserIdQuery = `SELECT userid FROM users WHERE clientid='${clientid}'`;
  let { code, rows } = await performQuery(client, getUserIdQuery);
  // The client id was verified in middleware, so this should always return a value.
  return rows[0].userid as string;
};

const uploadFile = async (fileData: any): Promise<string> => {
  aws.config.update({
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  });
  const s3 = new aws.S3();
  const fileContent = Buffer.from(fileData.file.data, "binary");
  // Generate a new unique file id even if the name is not unique.
  const fileKey = `${uuidv4()}_${fileData.file.name}`;

  const params = {
    Bucket: "etiennethompson-inventory-bucket",
    Key: fileKey,
    Body: fileContent,
  };
  let imageUrl = `${process.env.AWS_BUCKET_ENDPOINT}/${fileKey}`;
  await s3.upload(params).promise();
  return imageUrl;
};

const deleteFile = async (imageUrl: string): Promise<void> => {
  aws.config.update({
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  });
  const s3 = new aws.S3();

  let imageName = imageUrl.split("/").pop();
  if (!imageName) {
    return;
  }

  const params = {
    Bucket: "etiennethompson-inventory-bucket",
    Key: imageName,
  };
  await s3.deleteObject(params).promise();
};

export const getBaseFolder = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  let params = req.query;
  let userid = await getUserId(client, params.clientid as string);
  const getBaseFolderQuery = `SELECT folderid, name, picture FROM folders WHERE owner='${userid}' AND parent_folder is null;`;
  const { code, rows } = await performQuery(client, getBaseFolderQuery);
  if (code !== 200) {
    res.status(404);
    res.write(JSON.stringify({ message: "You have no root folder." }));
    next();
    return;
  }

  let folderInfo = rows[0];
  res.status(200);
  res.write(JSON.stringify({ folder: folderInfo }));
  next();
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
    next();
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
    next();
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
  const newFolder = req.body as CreateRequest;
  const clientid = req.body.clientid;

  let userid = await getUserId(client, clientid);
  let newFolderId = uuidv4();
  let currentTime = getCurrentTimeField();

  let imageUrl = "";
  if (req.files) {
    imageUrl = await uploadFile(req.files);
  }

  const createFolderQuery = `INSERT INTO folders (folderid, name, description, picture, owner, parent_folder, created, updated) VALUES ('${newFolderId}', '${newFolder.name}', '${newFolder.description}', '${imageUrl}', '${userid}', '${newFolder.parent_folder}', '${currentTime}', '${currentTime}');`;
  let { code, rows } = await performQuery(client, createFolderQuery);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdElement: {
          id: newFolderId,
          name: newFolder.name,
          picture: imageUrl,
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
  const newItem = req.body as CreateRequest;
  const clientid = req.body.clientid as string;

  let userid = await getUserId(client, clientid);
  let newItemId = uuidv4();
  let currentTime = getCurrentTimeField();

  let imageUrl = "";
  if (req.files) {
    imageUrl = await uploadFile(req.files);
  }

  const createItemQuery = `INSERT INTO items (itemid, name, description, picture, owner, parent_folder, created, updated) VALUES ('${newItemId}', '${newItem.name}', '${newItem.description}', '${imageUrl}', '${userid}', '${newItem.parent_folder}', '${currentTime}', '${currentTime}');`;
  let { code, rows } = await performQuery(client, createItemQuery);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdElement: {
          id: newItemId,
          name: newItem.name,
          picture: imageUrl,
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
  var reqBody = req.body;

  let userid = await getUserId(client, clientid);
  const getCurrentPictureQuery = `SELECT picture FROM folders WHERE folderid='${reqBody.id}' AND owner='${userid}';`;
  let { code, rows } = await performQuery(client, getCurrentPictureQuery);
  let currentPicture = rows[0].picture as string;

  let updatedImageUrl = "";
  if (
    req.files &&
    currentPicture.includes(`${process.env.AWS_BUCKET_ENDPOINT}`)
  ) {
    // We're trying to upload a new image and one already existed, so delete
    // the old one.
    await deleteFile(currentPicture);
  }

  if (req.files) {
    // We're uploading a new image.
    updatedImageUrl = await uploadFile(req.files);
  }

  let updateFolderQuery;
  if (updatedImageUrl) {
    updateFolderQuery = `UPDATE folders SET name='${reqBody.name}', description='${reqBody.description}', picture='${updatedImageUrl}' WHERE folderid='${reqBody.id}' AND owner='${userid}'`;
  } else {
    updateFolderQuery = `UPDATE folders SET name='${reqBody.name}', description='${reqBody.description}' WHERE folderid='${reqBody.id}' AND owner='${userid}'`;
  }
  ({ code, rows } = await performQuery(client, updateFolderQuery));

  // Determine which picture to send to the user.
  let returnImageUrl = updatedImageUrl ? updatedImageUrl : currentPicture;

  res.status(code);
  res.write(
    JSON.stringify({
      picture: returnImageUrl,
    })
  );
  next();
};

export const updateItem = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  const clientid: string = req.body.clientid;
  var reqBody = req.body;

  let userid = await getUserId(client, clientid);
  const getCurrentPictureQuery = `SELECT picture FROM items WHERE itemid='${reqBody.id}' AND owner='${userid}';`;
  let { code, rows } = await performQuery(client, getCurrentPictureQuery);
  let currentPicture = rows[0].picture;

  let updatedImageUrl = "";
  if (
    req.files &&
    currentPicture.includes(`${process.env.AWS_BUCKET_ENDPOINT}`)
  ) {
    await deleteFile(currentPicture);
  }

  if (req.files) {
    updatedImageUrl = await uploadFile(req.files);
  }

  let updateItemQuery;
  // Determine SQL command based on it image was uploaded or not.
  if (updatedImageUrl) {
    updateItemQuery = `UPDATE items SET name='${reqBody.name}', description='${reqBody.description}', picture='${updatedImageUrl}' WHERE itemid='${reqBody.id}' AND owner='${userid}'`;
  } else {
    updateItemQuery = `UPDATE items SET name='${reqBody.name}', description='${reqBody.description}' WHERE itemid='${reqBody.id}' AND owner='${userid}'`;
  }
  ({ code, rows } = await performQuery(client, updateItemQuery));

  // Determine what image to return.
  let returnImageUrl = updatedImageUrl ? updatedImageUrl : currentPicture;

  res.status(code);
  res.write(
    JSON.stringify({
      picture: returnImageUrl,
    })
  );
  next();
};

export const deleteFolder = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  // delete from folders where folderid='${folderid}' and owner='${userid}'
  const folderid: string = req.body.folderid;
  const clientid: string = req.body.clientid;

  let userid = await getUserId(client, clientid);
  const getPictureQuery = `SELECT picture FROM folders WHERE folderid='${folderid}' AND owner='${userid}';`;
  let { code, rows } = await performQuery(client, getPictureQuery);
  let currentPicture = rows[0].picture;

  const deleteFolderQuery = `DELETE FROM folders WHERE folderid='${folderid}' AND owner='${userid}';`;
  ({ code, rows } = await performQuery(client, deleteFolderQuery));

  if (code === 200) {
    // Only delete the file in AWS if deletion from database was successful.
    await deleteFile(currentPicture);
  }

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
  const getPictureQuery = `SELECT picture FROM items WHERE itemid='${itemid}' AND owner='${userid}';`;
  let { code, rows } = await performQuery(client, getPictureQuery);
  let currentPicture = rows[0].picture;

  const deleteItemQuery = `DELETE FROM items WHERE itemid='${itemid}' AND owner='${userid}';`;
  ({ code, rows } = await performQuery(client, deleteItemQuery));

  if (code === 200) {
    // Only delete the file in AWS if deletion from database was successful.
    await deleteFile(currentPicture);
  }

  if (code === 200) {
    res.status(200);
    res.write(JSON.stringify({ message: "Item was successfully deleted." }));
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "Failed to delete item." }));
  }
  next();
};

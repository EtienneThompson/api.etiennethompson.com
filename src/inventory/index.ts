import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import aws from "aws-sdk";
import { QueryProps, performQuery } from "../utils/database";
import { getCurrentTimeField, createReadableTimeField } from "../utils/date";
import { CreateRequest } from "./types";

const getUserId = async (client: any, clientid: string): Promise<string> => {
  let query: QueryProps = {
    text: "SELECT userid FROM users WHERE clientid='$1';",
    values: [clientid],
  };
  let { code, rows } = await performQuery(client, query);
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

  let bucketName: string = process.env.AWS_BUCKET_NAME || "";

  const params = {
    Bucket: bucketName,
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

  let bucketName: string = process.env.AWS_BUCKET_NAME || "";

  const params = {
    Bucket: bucketName,
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
  let query: QueryProps = {
    text: "SELECT folderid, name, picture FROM folders WHERE owner='$1' AND parent_folder is null;",
    values: [userid],
  };
  const { code, rows } = await performQuery(client, query);
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
  let query: QueryProps = {
    text: "SELECT folderid, name, picture, description, parent_folder, created, updated FROM folders WHERE folderid='$1' AND owner='$2';",
    values: [params.folderid as string, userid],
  };
  let { code, rows } = await performQuery(client, query);

  if (code !== 200) {
    res.status(404);
    res.write(JSON.stringify({ message: "That folder was not found." }));
    next();
    return;
  }
  let folderInfo = rows[0];

  query = {
    text: "SELECT folderid, name, picture FROM folders WHERE parent_folder='$1' AND owner='$2';",
    values: [params.folderid as string, userid],
  };
  ({ code, rows } = await performQuery(client, query));

  let children: any[] = [];
  if (code === 200) {
    let folderChildren = rows.map((child) => {
      child.type = "folder";
      child.id = child.folderid;
      return child;
    });
    children = children.concat(folderChildren);
  }

  query = {
    text: "SELECT itemid, name, picture FROM items WHERE parent_folder='$1' AND owner='$2';",
    values: [params.folderid as string, userid],
  };
  ({ code, rows } = await performQuery(client, query));
  if (code === 200) {
    let itemChildren = rows.map((child) => {
      child.type = "item";
      child.id = child.itemid;
      return child;
    });
    children = children.concat(itemChildren);
  }

  folderInfo.children = children;
  folderInfo.created = createReadableTimeField(folderInfo.created);
  folderInfo.updated = createReadableTimeField(folderInfo.updated);
  res.status(200);
  res.write(JSON.stringify({ folder: folderInfo }));
  next();
};

export const getItem = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  let params = req.query;
  let userid = await getUserId(client, params.clientid as string);
  let query: QueryProps = {
    text: "SELECT itemid, name, picture, description, parent_folder, created, updated FROM items WHERE itemid='$1' AND owner='$2';",
    values: [params.itemid as string, userid],
  };
  let { code, rows } = await performQuery(client, query);

  if (code !== 200) {
    res.status(404);
    res.write(JSON.stringify({ message: "That item was not found." }));
    next();
    return;
  }

  let itemInfo = rows[0];
  itemInfo.created = createReadableTimeField(itemInfo.created);
  itemInfo.updated = createReadableTimeField(itemInfo.updated);
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

  let query: QueryProps = {
    text: "INSERT INTO folders (folderid, name, description, picture, owner, parent_folder, created, updated) VALUES ('$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8');",
    values: [
      newFolderId,
      newFolder.name,
      newFolder.description,
      imageUrl,
      userid,
      newFolder.parent_folder,
      currentTime,
      currentTime,
    ],
  };
  let { code, rows } = await performQuery(client, query);

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

  let query: QueryProps = {
    text: "INSERT INTO items (itemid, name, description, picture, owner, parent_folder, created, updated) VALUES ('$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8');",
    values: [
      newItemId,
      newItem.name,
      newItem.description,
      imageUrl,
      userid,
      newItem.parent_folder,
      currentTime,
      currentTime,
    ],
  };
  let { code, rows } = await performQuery(client, query);

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
  let query: QueryProps = {
    text: "SELECT picture FROM folders WHERE folderid='$1' AND owner='$2';",
    values: [reqBody.id, userid],
  };
  let { code, rows } = await performQuery(client, query);
  let currentPicture = rows[0].picture as string;

  let updatedImageUrl = "";
  if (
    req.files &&
    currentPicture &&
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
  let updatedTime = getCurrentTimeField();
  let currentDate = new Date();
  if (updatedImageUrl) {
    query = {
      text: "UPDATE folders SET name='$1', description='$2', picture='$3', updated='$4' WHERE folderid='$5' AND owner='$6';",
      values: [
        reqBody.name,
        reqBody.description,
        updatedImageUrl,
        updatedTime,
        reqBody.id,
        userid,
      ],
    };
  } else {
    query = {
      text: "UPDATE folders SET name='$1', description='$2', updated='$3' WHERE folderid='$4' AND owner='$5';",
      values: [
        reqBody.name,
        reqBody.description,
        updatedTime,
        reqBody.id,
        userid,
      ],
    };
  }
  ({ code, rows } = await performQuery(client, query));

  // Determine which picture to send to the user.
  let returnImageUrl = updatedImageUrl ? updatedImageUrl : currentPicture;

  res.status(code);
  res.write(
    JSON.stringify({
      picture: returnImageUrl,
      updated: createReadableTimeField(currentDate),
    })
  );
  next();
};

export const updateItem = async (req: Request, res: Response, next: any) => {
  const client = req.body.client;
  const clientid: string = req.body.clientid;
  var reqBody = req.body;

  let userid = await getUserId(client, clientid);
  let query: QueryProps = {
    text: "SELECT picture FROM items WHERE itemid='$1' AND owner='$2';",
    values: [reqBody.id, userid],
  };
  let { code, rows } = await performQuery(client, query);
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
  let updatedTime = getCurrentTimeField();
  let currentDate = new Date();
  // Determine SQL command based on it image was uploaded or not.
  if (updatedImageUrl) {
    query = {
      text: "UPDATE items SET name='$1', description='$2', picture='$3', updated='$4' WHERE itemid='$5' AND owner='$6';",
      values: [
        reqBody.name,
        reqBody.description,
        updatedImageUrl,
        updatedTime,
        reqBody.id,
        userid,
      ],
    };
  } else {
    query = {
      text: "UPDATE items SET name='$1', description='$2', updated='$3' WHERE itemid='$4' AND owner='$5';",
      values: [
        reqBody.name,
        reqBody.description,
        updatedTime,
        reqBody.id,
        userid,
      ],
    };
  }
  ({ code, rows } = await performQuery(client, query));

  // Determine what image to return.
  let returnImageUrl = updatedImageUrl ? updatedImageUrl : currentPicture;

  res.status(code);
  res.write(
    JSON.stringify({
      picture: returnImageUrl,
      updated: createReadableTimeField(currentDate),
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
  let query: QueryProps = {
    text: "SELECT picture FROM folders WHERE folderid='$1' AND owner='$2';",
    values: [folderid, userid],
  };
  let { code, rows } = await performQuery(client, query);
  let currentPicture = rows[0].picture;

  query = {
    text: "DELETE FROM folders WHERE folderid='$1' AND owner='$2';",
    values: [folderid, userid],
  };
  ({ code, rows } = await performQuery(client, query));

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
  let query: QueryProps = {
    text: "SELECT picture FROM items WHERE itemid='$1' AND owner='$2';",
    values: [itemid, userid],
  };
  let { code, rows } = await performQuery(client, query);
  let currentPicture = rows[0].picture;

  query = {
    text: "DELETE FROM items WHERE itemid='$1' AND owner='$2';",
    values: [itemid, userid],
  };
  ({ code, rows } = await performQuery(client, query));

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

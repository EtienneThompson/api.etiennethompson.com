import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import aws from "aws-sdk";
import { QueryProps, DatabaseConnection } from "../utils/database";
import { getCurrentTimeField, createReadableTimeField } from "../utils/date";
import {
  Breadcrumb,
  BreadcrumbFolder,
  BreadcrumbItem,
  CreateRequest,
  ElementTypes,
  FolderChildren,
  FolderElement,
  ItemElement,
} from "./types";
import {
  HttpStatusCode,
  ResponseHelper,
  SuccessfulStatusCode,
} from "../utils/response";

/**
 * Gets breadcrumb data for an item in the database.
 * @param client The database client used to query.
 * @param userid The userid the item belongs to.
 * @param itemid The id of the item to query for.
 * @returns The Breadcrumb data for that item or null if that item does not exist.
 */
const getItemBreadcrumb = async (
  client: DatabaseConnection,
  userid: string,
  itemid: string
): Promise<Breadcrumb | null> => {
  // Get the information required for the breadcrumb for the current item.
  let query: QueryProps = {
    name: "inventoryGetItemBreadcrumb",
    text: "SELECT itemid, name, parent_folder FROM items WHERE itemid=$1 AND owner=$2",
    values: [itemid, userid],
  };
  let rows = await client.PerformQuery(query);
  let item: BreadcrumbItem = rows[0];

  // Get the breadcrumb trail for the parent folder.
  let breadcrumb = await getFolderBreadcrumb(
    client,
    userid,
    item.parent_folder
  );
  if (breadcrumb === null) {
    return null;
  }

  // Add the item onto the end of the breadcrumb generated for the parent folder.
  breadcrumb.names.push(item.name);
  breadcrumb.values.push(item.itemid);
  breadcrumb.types.push(ElementTypes.Item);

  return breadcrumb;
};

/**
 * Gets breadcrumb data for the given folder and all it's parent folders.
 * @param client The database client used to query.
 * @param userid The userid the folder belongs to.
 * @param folderid The id of the folder to query for.
 * @returns
 */
const getFolderBreadcrumb = async (
  client: DatabaseConnection,
  userid: string,
  folderid: string
): Promise<Breadcrumb | null> => {
  let breadcrumb: Breadcrumb = {
    names: [],
    values: [],
    types: [],
  };

  // Get the first folder for the folderid.
  let query: QueryProps = {
    name: "inventoryGetFolderBreadcrumb",
    text: "SELECT folderid, name, parent_folder FROM folders WHERE folderid=$1 AND owner=$2",
    values: [folderid, userid],
  };
  let rows = await client.PerformQuery(query);
  // Add the breadcrumb information to the beginning of the array.
  let folder: BreadcrumbFolder = rows[0];
  breadcrumb.names.splice(0, 0, folder.name);
  breadcrumb.values.splice(0, 0, folder.folderid);
  breadcrumb.types.splice(0, 0, "folder");

  // Get the breadcrumb for each parent folder and add it to the beginning of
  // the return data.
  while (folder.parent_folder) {
    query.values = [folder.parent_folder, userid];
    let parentRows = await client.PerformQuery(query);
    folder = parentRows[0];
    breadcrumb.names.splice(0, 0, folder.name);
    breadcrumb.values.splice(0, 0, folder.folderid);
    breadcrumb.types.splice(0, 0, "folder");
  }

  return breadcrumb;
};

/**
 * Get all the children data for a given folder.
 * @param client The database client used to query.
 * @param userid The userid the children belong to.
 * @param folderid The folderid used as the parent folder for all children.
 * @returns A list of all children elements.
 */
const getChildren = async (
  client: DatabaseConnection,
  userid: string,
  folderid: string
): Promise<FolderChildren[]> => {
  let children: FolderChildren[] = [];
  // Get the children folders.
  let query: QueryProps = {
    name: "inventoryGetChildrenFolderQuery",
    text: "SELECT folderid, name, picture FROM folders WHERE parent_folder=$1 AND owner=$2;",
    values: [folderid, userid],
  };
  let childrenRows = await client.PerformQuery(query);

  let folderChildren = childrenRows.map((child: FolderChildren) => {
    child.type = "folder";
    child.id = child.folderid;
    return child;
  });
  children = children.concat(folderChildren);

  // Get the children items.
  query = {
    name: "inventoryGetChildrenItemQuery",
    text: "SELECT itemid, name, picture FROM items WHERE parent_folder=$1 AND owner=$2;",
    values: [folderid, userid],
  };
  childrenRows = await client.PerformQuery(query);
  let itemChildren = childrenRows.map((child: FolderChildren) => {
    child.type = ElementTypes.Item;
    child.id = child.itemid;
    return child;
  });
  children = children.concat(itemChildren);

  return children;
};

/**
 * Gets the currently stored image url for an element.
 * @param client The database client to query with.
 * @param userid The id of the user the element is owned by.
 * @param elementId The id of the element.
 * @param elementType The type of the element.
 * @returns The image url or an empty string.
 */
const getImageUrl = async (
  client: DatabaseConnection,
  userid: string,
  elementId: string,
  elementType: ElementTypes
): Promise<string> => {
  // Construct query to get the current image uploaded for a folder.
  let query: QueryProps | undefined = undefined;
  if (elementType === ElementTypes.Folder) {
    query = {
      name: "inventoryGetFolderPictureQuery",
      text: "SELECT picture FROM folders WHERE folderid=$1 AND owner=$2;",
      values: [elementId, userid],
    };
  } else if (elementType === ElementTypes.Item) {
    query = {
      name: "inventoryGetItemPictureQuery",
      text: "SELECT picture FROM items WHERE itemid=$1 AND owner=$2;",
      values: [elementId, userid],
    };
  }

  let rows: any[];
  if (query) {
    rows = await client.PerformQuery(query);
  } else {
    return "";
  }

  return rows[0].picture as string;
};

/**
 * Upload a file to AWS S3 for persistent storage.
 * @param fileData The file data to upload. This should come from FormData.
 * @returns The url for the file that was uploaded, to be stored in the database
 *    for future reference.
 */
const uploadFile = async (fileData: any): Promise<string> => {
  // Configure the AWS client.
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
  // Generate the url that the image can be accessed on.
  let imageUrl = `${process.env.AWS_BUCKET_ENDPOINT}/${fileKey}`;
  await s3.upload(params).promise();
  return imageUrl;
};

/**
 * Delete a file from AWS S3 for keeping storage manageable.
 * @param imageUrl The url of the image to delete.
 * @returns void
 */
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

/**
 * Returns the root folder of a user's inventory system.
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 * @returns void
 */
export const getBaseFolder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  let params = req.query;
  let userid = await client.GetUserId(params.clientid as string);
  // Get the folder where the parent_folder is null, which is the base folder
  // of the inventory system for that user.
  let query: QueryProps = {
    name: "inventoryGetBaseFolderQuery",
    text: "SELECT folderid, name, picture FROM folders WHERE owner=$1 AND parent_folder is null;",
    values: [userid],
  };
  const folders = await client.PerformQuery(query);

  let folderInfo = folders[0] as FolderElement;
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    folder: folderInfo,
  });
};

/**
 * Gets a provided folder information and children.
 * @param req The Express request object, with the clientid and folderid as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 * @returns void
 */
export const getFolder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  let params = req.query;
  let userid = await client.GetUserId(params.clientid as string);

  let folderid = params.folderid as string;
  let query: QueryProps = {
    name: "inventoryGetFolderQuery",
    text: "SELECT folderid, name, picture, description, parent_folder, created, updated FROM folders WHERE folderid=$1 AND owner=$2;",
    values: [folderid, userid],
  };
  let folders = await client.PerformQuery(query);
  let folderInfo = folders[0] as FolderElement;

  // Get breadcrumb and children information for that folder.
  let breadcrumb = await getFolderBreadcrumb(client, userid, folderid);
  let children = await getChildren(client, userid, folderid);

  folderInfo.children = children;
  // Convert the dates into readable dates.
  if (folderInfo.created) {
    folderInfo.created = createReadableTimeField(new Date(folderInfo.created));
  }
  if (folderInfo.updated) {
    folderInfo.updated = createReadableTimeField(new Date(folderInfo.updated));
  }

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    folder: folderInfo,
    breadcrumb: breadcrumb,
  });
};

/**
 * Gets an individual item from the user's inventory.
 * @param req The Express request object, with clientid and itemid as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 * @returns void
 */
export const getItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  let params = req.query;
  let userid = await client.GetUserId(params.clientid as string);

  let itemid = params.itemid as string;
  let query: QueryProps = {
    name: "inventoryGetItemQuery",
    text: "SELECT itemid, name, picture, description, parent_folder, created, updated FROM items WHERE itemid=$1 AND owner=$2;",
    values: [itemid, userid],
  };
  let items = await client.PerformQuery(query);

  let breadcrumb = await getItemBreadcrumb(client, userid, itemid);

  // Update the fields appropriately.
  let itemInfo = items[0] as ItemElement;

  // Convert the dates into readable times.
  if (itemInfo.created) {
    itemInfo.created = createReadableTimeField(new Date(itemInfo.created));
  }
  if (itemInfo.updated) {
    itemInfo.updated = createReadableTimeField(new Date(itemInfo.updated));
  }

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    item: itemInfo,
    breadcrumb: breadcrumb,
  });
};

/**
 * Gets only the children for a given folder.
 * @param req The Express request object, with the clientid and folderid as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const getFolderChildren = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  let clientid = req.query.clientid as string;
  let folderid = req.query.folderid as string;
  let userid = await client.GetUserId(clientid);

  let children = await getChildren(client, userid, folderid);
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    children: children,
  });
};

/**
 * Creates a new, empty folder in the user's inventory.
 * @param req The Express request object, with the folder details as payload.
 *    Requires a name, description, image, and parent_folder.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const createFolder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const newFolder = req.body as CreateRequest;
  const clientid = req.body.clientid;
  let userid = await client.GetUserId(clientid);

  // Generate unique id and current time for the other fields of a folder.
  let newFolderId = uuidv4();
  let currentTime = getCurrentTimeField();

  // Upload the image if an image was provided and get the url back.
  let imageUrl = "";
  if (req.files) {
    imageUrl = await uploadFile(req.files);
  }

  // Construct the database query.
  let query: QueryProps = {
    name: "inventoryCreateFolderQuery",
    text: "INSERT INTO folders (folderid, name, description, picture, owner, parent_folder, created, updated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
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
  await client.PerformQuery(query);

  // Send back the information required by the application for the created folder.
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    createdElement: {
      id: newFolderId,
      name: newFolder.name,
      picture: imageUrl,
      type: ElementTypes.Folder,
    },
  });
};

/**
 * Creates an item in the user's inventory.
 * @param req The Express request object, with item details as payload.
 *    Requires name, description, image, and parent_folder.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const createItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const newItem = req.body as CreateRequest;
  const clientid = req.body.clientid as string;
  let userid = await client.GetUserId(clientid);

  // Generate the unique id and current time for the other fields of the item.
  let newItemId = uuidv4();
  let currentTime = getCurrentTimeField();

  // Upload the image if an image was provided and get the url back.
  let imageUrl = "";
  if (req.files) {
    imageUrl = await uploadFile(req.files);
  }

  // Construct the query to create an item entry.
  let query: QueryProps = {
    name: "inventoryCreateItemQuery",
    text: "INSERT INTO items (itemid, name, description, picture, owner, parent_folder, created, updated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
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
  await client.PerformQuery(query);

  // Return useful information to the front end to update it's UI.
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    createdElement: {
      id: newItemId,
      name: newItem.name,
      picture: imageUrl,
      type: ElementTypes.Item,
    },
  });
};

/**
 * Update a folder's details.
 * @param req The Express request object, with folder details as payload.
 *    Requires name, description, and image.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const updateFolder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const clientid: string = req.body.clientid;
  var reqBody = req.body;

  // Construct query to get the current image uploaded for a folder.
  let userid = await client.GetUserId(clientid);
  let currentPicture = await getImageUrl(
    client,
    userid,
    reqBody.id,
    ElementTypes.Folder
  );

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

  // Construct the update folder query, based on if an image was uploaded or not.
  let query: QueryProps;
  let updatedTime = getCurrentTimeField();
  let currentDate = new Date();
  if (updatedImageUrl) {
    query = {
      name: "inventoryUpdateFolderWithPictureQuery",
      text: "UPDATE folders SET name=$1, description=$2, picture=$3, updated=$4 WHERE folderid=$5 AND owner=$6;",
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
      name: "inventoryUpdateFolderQuery",
      text: "UPDATE folders SET name=$1, description=$2, updated=$3 WHERE folderid=$4 AND owner=$5;",
      values: [
        reqBody.name,
        reqBody.description,
        updatedTime,
        reqBody.id,
        userid,
      ],
    };
  }
  await client.PerformQuery(query);

  // Determine which picture to send to the user.
  let returnImageUrl = updatedImageUrl ? updatedImageUrl : currentPicture;

  // Send the updated information back to the user that they don't already have.
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    picture: returnImageUrl,
    updated: createReadableTimeField(currentDate),
  });
};

/**
 * Update an item's details, and uploads new image if applicable.
 * @param req The Express request object, with item details as payload.
 *    Requires name, description, and image.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const updateItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const clientid: string = req.body.clientid;
  var reqBody = req.body;

  // Get the current image url for the item.
  let userid = await client.GetUserId(clientid);
  let currentPicture = await getImageUrl(
    client,
    userid,
    reqBody.id,
    ElementTypes.Item
  );

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

  let query: QueryProps;
  let updatedTime = getCurrentTimeField();
  let currentDate = new Date();
  // Determine SQL command based on it image was uploaded or not.
  if (updatedImageUrl) {
    query = {
      name: "inventoryUpdateItemWithPictureQuery",
      text: "UPDATE items SET name=$1, description=$2, picture=$3, updated=$4 WHERE itemid=$5 AND owner=$6;",
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
      name: "inventoryUpdateItemQuery",
      text: "UPDATE items SET name=$1, description=$2, updated=$3 WHERE itemid=$4 AND owner=$5;",
      values: [
        reqBody.name,
        reqBody.description,
        updatedTime,
        reqBody.id,
        userid,
      ],
    };
  }
  await client.PerformQuery(query);

  // Determine what image to return.
  let returnImageUrl = updatedImageUrl ? updatedImageUrl : currentPicture;

  // Return information front end doesn't already have.
  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    picture: returnImageUrl,
    updated: createReadableTimeField(currentDate),
  });
};

/**
 * Deletes a given folder from the system.
 * @param req The Express request object, with the folder id as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const deleteFolder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const folderid: string = req.body.folderid;
  const clientid: string = req.body.clientid;

  // Get the current image url uploaded for the folder.
  let userid = await client.GetUserId(clientid);
  let currentPicture = await getImageUrl(
    client,
    userid,
    folderid,
    ElementTypes.Folder
  );

  // Construct the query to delete the folder.
  let query: QueryProps = {
    name: "inventoryDeleteFolderQuery",
    text: "DELETE FROM folders WHERE folderid=$1 AND owner=$2;",
    values: [folderid, userid],
  };
  await client.PerformQuery(query);
  await deleteFile(currentPicture);

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    message: "Folder was successfully deleted.",
  });
};

/**
 * Delete a given item from the system.
 * @param req The Express request object, with the item id as payload.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const deleteItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const itemid: string = req.body.itemid;
  const clientid: string = req.body.clientid;

  // Get the current image url uploaded for the item.
  let userid = await client.GetUserId(clientid);
  let currentPicture = await getImageUrl(
    client,
    userid,
    itemid,
    ElementTypes.Item
  );

  // Construct the query for deleting the item.
  let query: QueryProps = {
    name: "inventoryDeleteItemPicture",
    text: "DELETE FROM items WHERE itemid=$1 AND owner=$2;",
    values: [itemid, userid],
  };
  let response = await client.PerformQuery(query);
  await deleteFile(currentPicture);

  responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok, {
    message: "Item was successfully deleted.",
  });
};

/**
 * Move an element from one folder to another.
 * @param req The Express request object, with move data as payload.
 *    Requires the id of the element to move to, the id of the element that
 *    will be moved, and the type of the element that is being moved.
 * @param res The Express response object.
 * @param next The next function in the request lifecycle.
 */
export const moveElement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const client = req.body.client as DatabaseConnection;
  const responseHelper = req.body.response as ResponseHelper;
  const moveToId: string = req.body.moveToId;
  const movingId: string = req.body.movingId;
  const movingType: string = req.body.movingType;
  const clientid: string = req.body.clientid;

  let userid = await client.GetUserId(clientid);
  let query: QueryProps = { name: "", text: "", values: [] };
  // Construct the query for moving the item based on type.
  if (movingType === "folder") {
    query = {
      name: "inventoryMoveFolderQuery",
      text: "UPDATE folders SET parent_folder=$1 WHERE folderid=$2 AND owner=$3;",
      values: [moveToId, movingId, userid],
    };
  } else {
    query = {
      name: "inventoryMovingItemQuery",
      text: "UPDATE items SET parent_folder=$1 WHERE itemid=$2 AND owner=$3;",
      values: [moveToId, movingId, userid],
    };
  }
  let response = await client.PerformQuery(query);

  responseHelper.GenericResponse(HttpStatusCode.Ok);
};

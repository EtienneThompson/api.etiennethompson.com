/* Common fields between Folders and Items. */
export interface ElementBase {
  name?: string;
  description?: string;
  owner?: string;
  picture?: string;
  parent_folder?: string;
  created?: string;
  updated?: string;
}

/* Data stored for children of a folder. */
export interface FolderChildren {
  id: string | undefined;
  folderid?: string;
  itemid?: string;
  type: "folder" | "item";
  name: string;
  picture: string;
}

/* Extra fields stored by a Folder. */
export interface FolderElement extends ElementBase {
  folderid?: string;
  children?: FolderChildren[];
}

/* Extra fields stored by an Item. */
export interface ItemElement extends ElementBase {
  itemid?: string;
}

/* Extra fields stored by generic Elements. */
export interface ElementGeneric extends ElementBase {
  id?: string;
}

/* Data expected by a create request. */
export interface CreateRequest {
  name: string;
  description: string;
  picture: string;
  parent_folder: string;
}

/* Fields needed to construct a breadcrumb trail. */
export interface Breadcrumb {
  names: string[];
  values: string[];
  types: string[];
}

/* Values queried for when constructing a breadcrumb for a Folder. */
export interface BreadcrumbFolder {
  folderid: string;
  name: string;
  parent_folder: string;
}

/* Values queried for when constructing a breadcrumb for an Item. */
export interface BreadcrumbItem {
  itemid: string;
  name: string;
  parent_folder: string;
}

/* Possible types for an Element. */
export enum ElementTypes {
  Item = "item",
  Folder = "folder",
}

export interface ElementBase {
  name?: string;
  description?: string;
  owner?: string;
  picture?: string;
  parent_folder?: string;
  created?: string;
  updated?: string;
}

export interface FolderChildren {
  id: string | undefined;
  folderid?: string;
  itemid?: string;
  type: "folder" | "item";
  name: string;
  picture: string;
}

export interface FolderElement extends ElementBase {
  folderid?: string;
  children?: FolderChildren[];
}

export interface ItemElement extends ElementBase {
  itemid?: string;
}

export interface ElementGeneric extends ElementBase {
  id?: string;
}

export interface CreateRequest {
  name: string;
  description: string;
  picture: string;
  parent_folder: string;
}

export interface Breadcrumb {
  names: string[];
  values: string[];
  types: string[];
}

export interface BreadcrumbFolder {
  folderid: string;
  name: string;
  parent_folder: string;
}

export interface BreadcrumbItem {
  itemid: string;
  name: string;
  parent_folder: string;
}

export enum ElementTypes {
  Item = "item",
  Folder = "folder",
}

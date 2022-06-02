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

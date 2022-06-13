export interface Users {
  userid: string;
  username: string;
  hashedPassword: string;
  clientid: string;
  expiration: string;
}

export interface ReturnUser {
  userid: string;
  username: string;
  clientid: string;
}

interface SelectOptions {
  id: string;
  value: string;
  text: string;
}

interface DefaultValues {
  id: string;
  value: string | boolean;
  label: string;
  component: string;
  editable: boolean;
  options?: SelectOptions[];
}

interface Header {
  text: string;
  field: string;
}

interface EditField {
  text: string;
  field: string;
  edit: boolean;
}

export interface GetResponseData {
  elements: any[];
  headers: Header[];
  editableFields: EditField[];
  newFields: Header[];
  defaultValues: DefaultValues[];
}

export interface CreateRequestUsers {
  username: string;
  password: string;
}

export interface UpdateUserRequest {
  userid: string;
  username: string;
  hashedPassword: string;
}

export interface DeleteUserRequest {
  userid: string;
}

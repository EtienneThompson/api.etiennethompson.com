export interface Map {
  [key: string]: string;
}

export interface QueryResponse {
  code: number;
  rows: any[];
}

export interface BaseRequest {
  clientid: string;
  appid: string;
}

export type UserEntry = {
  userid: string;
  username: string;
  password: string;
  clientid: string;
  session_expiration: string;
};

interface SelectOptions {
  id: string;
  value: string;
  text: string;
}

export interface DefaultValues {
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

export interface AdminGetResponseData {
  elements: any[];
  headers: Header[];
  editableFields: EditField[];
  newFields: Header[];
  defaultValues: DefaultValues[];
}

export interface ColumnMap {
  [key: string]: string | boolean;
}

export interface ColumnSchemaInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
}

export type ColumnType =
  | "text"
  | "checkbox"
  | "select"
  | "header"
  | "textarea";

export interface RenderCondition {
  dependentField: string;
  operator: string;
  value: string | boolean;
}

export interface DatabaseColumn {
  name: string;
  label: string;
  required: boolean;
  type: ColumnType;
  value: string | boolean;
  renderCondition?: RenderCondition;
  position: number;
  options?: string[];
}

export interface ClientDetailsTab {
  name: string;
  label: string;
  fields: DatabaseColumn[];
}

export interface ClientDetails {
  id: string;
  tabs: ClientDetailsTab[];
}

export enum IsNullable {
  Yes = "YES",
  No = "NO",
}

export interface InsertedEntry {
  tableName: string;
  id: string;
}

export interface FieldMetadata {
  tab_name: string;
  field_name: string;
  position: number;
}

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
  options?: string[];
}

export interface ClientDetailsTab {
  name: string;
  label: string;
  fields: DatabaseColumn[];
}

export enum IsNullable {
  Yes = "YES",
  No = "NO",
}

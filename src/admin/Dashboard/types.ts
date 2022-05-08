export interface TableNames {
  table_name: string;
}

export interface TableCount {
  count: string;
}

export interface TableNameCount {
  name: string;
  count: number;
}

export interface CountData {
  total: number;
  tables: TableNameCount[];
}

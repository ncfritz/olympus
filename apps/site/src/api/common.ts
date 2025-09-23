export interface SortOptions {
  field: string;
  order: "asc" | "desc";
}

export type PaginatedParams = {
  page: number;
  sort: SortOptions;
};

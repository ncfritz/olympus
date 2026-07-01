import type { SortDirection } from "@ncfritz/olympus-sdk/olympus";

export interface SortOptions {
  field: string;
  order: SortDirection;
}

export type PaginatedParams = {
  page: number;
  sort: SortOptions;
};

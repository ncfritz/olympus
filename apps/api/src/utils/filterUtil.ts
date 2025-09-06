export interface PaginationParams {
  pageSize: number;
  startPage: number;
  sortField: string;
  sortDirection: "asc" | "desc";
}

export const buildPaginationExpression = (params: PaginationParams): string => {
  return `limit: ${params.pageSize}, offset: ${params.pageSize * params.startPage}, order_by: {${params.sortField}: ${params.sortDirection}}`;
};

export const buildFilterExpression = (
  filters: string | undefined,
  initialFilters?: string[] | undefined,
): string | undefined => {
  const filterOptions = [...(initialFilters || [])];

  if (filters) {
    const decodedOptions = JSON.parse(
      Buffer.from(filters, "base64").toString("utf-8"),
    );

    for (const key in decodedOptions) {
      if (decodedOptions[key] && decodedOptions[key].length > 0) {
        const values = decodedOptions[key].map((value: string) => {
          return `"${value}"`;
        });

        filterOptions.push(`${key}: { _in: [${values.join(", ")}]}`);
      }
    }
  }

  return filterOptions.length > 0
    ? `where: {_and: {${filterOptions.join(", ")}}}`
    : undefined;
};

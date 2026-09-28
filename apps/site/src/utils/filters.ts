import type { FilterDefinition } from "@ncfritz/olympus-sdk/dionysus";
import type { FilterValue } from "antd/es/table/interface";

export const buildFilterDefinitionForTable = (
  filters: Record<string, FilterValue | null>,
): FilterDefinition | undefined => {
  const columnFilters: FilterDefinition[] = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.length > 0) {
      columnFilters.push({
        type: "in",
        name: key,
        value: value as string[],
      });
    }
  });

  if (columnFilters.length <= 0) {
    return undefined;
  } else if (columnFilters.length > 0) {
    return {
      type: "and",
      name: "_",
      value: columnFilters,
    };
  } else {
    return columnFilters[0];
  }
};

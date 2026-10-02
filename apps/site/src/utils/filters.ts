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

/**
 * A checkbox filter's keys after one is clicked: added when it was not
 * there, removed when it was.
 */
export const toggleKey = (keys: string[], key: string): string[] => {
  const next = [...keys];
  if (next.includes(key)) {
    next.splice(next.indexOf(key));
  } else {
    next.push(key);
  }
  return next;
};

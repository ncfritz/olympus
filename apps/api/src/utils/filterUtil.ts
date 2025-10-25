import { FilterDefinition, FilterType } from "@ncfritz/olympus-model";

export interface PaginationParams {
  pageSize: number;
  startPage: number;
  sortField: string;
  sortDirection: "asc" | "desc";
}

const ARRAY_OPERATIONS: FilterType[] = [FilterType.IN, FilterType.NOT_IN];
const JOINING_OPERATIONS: FilterType[] = [FilterType.AND, FilterType.OR];

export const buildPaginationExpression = (params: PaginationParams): string => {
  return `limit: ${params.pageSize}, offset: ${params.pageSize * params.startPage}, order_by: {${params.sortField}: ${params.sortDirection}}`;
};

export const buildFilterExpression = (
  definition?: FilterDefinition | string,
): string | undefined => {
  const decodedDefinition = parseFilterDefinition(definition);

  return decodedDefinition
    ? `where: {${buildFilterInternal(decodedDefinition)}}`
    : undefined;
};

const buildFilterInternal = (
  definition: FilterDefinition | FilterDefinition[],
  wrapFilter: boolean = false,
): string => {
  const filter: string[] = [];

  // If the definition passed in is an array, build the parts individually.  Otherwise, we know
  // the definition is singular, so we can operate directly on it.
  if (Array.isArray(definition)) {
    definition.forEach((subDefinition) => {
      filter.push(buildFilterInternal(subDefinition, wrapFilter));
    });
  } else {
    if (Array.isArray(definition.value) && definition.value.length > 0) {
      // Detect if the first value in the array is an object, if it is we can assume that this
      // is a FilterDefinition. If the value is not an object, we need to build the actual filter string.
      // In this situation, check if the filter handles array types, if not, only use the first value.
      if (typeof definition.value[0] === "object") {
        if (JOINING_OPERATIONS.includes(definition.type)) {
          return wrap(
            `_${definition.type}: [${buildFilterInternal(definition.value as FilterDefinition[], true)}]`,
            wrapFilter,
          );
        } else {
          filter.push(
            buildFilterInternal(definition.value as FilterDefinition[], true),
          );
        }
      } else {
        if (ARRAY_OPERATIONS.includes(definition.type)) {
          const values = definition.value.map((value) => {
            return formatValue(value as string | number);
          });

          return wrap(
            `${definition.name}: {_${definition.type}: [${values.join(", ")}]}`,
            wrapFilter,
          );
        } else {
          return wrap(
            `${definition.name}: {_${definition.type}: ${formatValue(definition.value[0])}}`,
            wrapFilter,
          );
        }
      }
    } else {
      if (typeof definition.value === "object") {
        filter.push(
          buildFilterInternal(definition.value as FilterDefinition, wrapFilter),
        );
      } else {
        return wrap(
          `${definition.name}: {_${definition.type}: ${formatValue(definition.value)}}`,
          wrapFilter,
        );
      }
    }
  }

  return filter.join(", ");
};

const formatValue = (value: string | number | boolean): string => {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  return value.toString();
};

const wrap = (filter: string, shouldWrap: boolean) => {
  return shouldWrap ? `{${filter}}` : filter;
};

export const parseFilterDefinition = (
  definition: FilterDefinition | string | undefined,
): FilterDefinition | undefined => {
  if (!definition) {
    return undefined;
  }

  return typeof definition === "string"
    ? (JSON.parse(
        Buffer.from(definition, "base64").toString("utf-8"),
      ) as unknown as FilterDefinition)
    : definition;
};

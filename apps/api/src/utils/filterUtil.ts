import {
  FilterDefinition,
  FilterType,
  SortDirection,
} from "@ncfritz/olympus-model";
import { BadRequestException } from "@nestjs/common";

export interface PaginationParams {
  pageSize: number;
  startPage: number;
  sortField: string;
  sortDirection: SortDirection;
  fallbackSort?: {
    sortField: string;
    sortDirection: SortDirection;
  };
}

const ARRAY_OPERATIONS: FilterType[] = [FilterType.IN, FilterType.NOT_IN];

// Field names and sort directions are interpolated into GraphQL documents,
// so they are restricted to identifier syntax / known values.
const FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const SORT_DIRECTIONS = new Set<string>(Object.values(SortDirection));
const FILTER_TYPES = new Set<string>(Object.values(FilterType));

const assertField = (name: string, what: string): void => {
  if (!FIELD_PATTERN.test(name)) {
    throw new BadRequestException(`Invalid ${what} "${name}"`);
  }
};
const JOINING_OPERATIONS: FilterType[] = [FilterType.AND, FilterType.OR];

export const buildPaginationExpression = (params: PaginationParams): string => {
  for (const sort of [params, params.fallbackSort]) {
    if (!sort) continue;
    assertField(sort.sortField, "sort field");
    if (!SORT_DIRECTIONS.has(sort.sortDirection)) {
      throw new BadRequestException(
        `Invalid sort direction "${sort.sortDirection}"`,
      );
    }
  }
  const pageSize = Number(params.pageSize);
  const startPage = Number(params.startPage);
  if (!Number.isInteger(pageSize) || pageSize < 0) {
    throw new BadRequestException(`Invalid page size "${params.pageSize}"`);
  }
  if (!Number.isInteger(startPage) || startPage < 0) {
    throw new BadRequestException(`Invalid start page "${params.startPage}"`);
  }
  const sortOptions = [`{${params.sortField}: ${params.sortDirection}}`];

  if (
    params.fallbackSort &&
    params.fallbackSort.sortField !== params.sortField
  ) {
    sortOptions.push(
      `{${params.fallbackSort.sortField}: ${params.fallbackSort.sortDirection}}`,
    );
  }

  const sortExpression =
    sortOptions.length > 0 ? `[${sortOptions.join(", ")}]` : sortOptions[0];

  return `limit: ${pageSize}, offset: ${pageSize * startPage}, order_by: ${sortExpression}`;
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
    if (!FILTER_TYPES.has(definition.type)) {
      throw new BadRequestException(`Invalid filter type "${definition.type}"`);
    }
    // "_" is the conventional placeholder name for joining filters.
    if (definition.name !== "_") assertField(definition.name, "filter field");
    const fieldParts = definition.name.split(".");
    let fieldName = fieldParts[0];
    let fieldSuffix = "";

    if (fieldParts.length > 1) {
      fieldName = fieldParts.join(": {");
      fieldSuffix = "".padEnd(fieldParts.length - 1, "}");
    }

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
            `${fieldName}: {_${definition.type}: [${values.join(", ")}]}${fieldSuffix}`,
            wrapFilter,
          );
        } else {
          return wrap(
            `${fieldName}: {_${definition.type}: ${formatValue(definition.value[0])}}${fieldSuffix}`,
            wrapFilter,
          );
        }
      }
    } else {
      // For existence filters, disregard the value since we are not testing on any value based element
      if (definition.type === FilterType.EXISTS) {
        if (definition.value !== false) {
          return wrap(`${fieldName}: {}`, wrapFilter);
        } else {
          return wrap(`_not: { ${fieldName}: {}}`, wrapFilter);
        }
      }

      if (typeof definition.value === "object") {
        filter.push(
          buildFilterInternal(definition.value as FilterDefinition, wrapFilter),
        );
      } else {
        return wrap(
          `${fieldName}: {_${definition.type}: ${formatValue(definition.value)}}${fieldSuffix}`,
          wrapFilter,
        );
      }
    }
  }

  return filter.join(", ");
};

const formatValue = (value: string | number | boolean): string => {
  if (typeof value === "string") {
    // JSON string syntax is valid GraphQL string syntax and escapes quotes,
    // backslashes and control characters.
    return JSON.stringify(value);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new BadRequestException(`Invalid filter value "${value}"`);
  }
  if (typeof value !== "number" && typeof value !== "boolean") {
    throw new BadRequestException("Invalid filter value");
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
  if (typeof definition !== "string") {
    return definition;
  }

  try {
    return JSON.parse(
      Buffer.from(definition, "base64").toString("utf-8"),
    ) as unknown as FilterDefinition;
  } catch {
    throw new BadRequestException(
      "`filters` must be a base64-encoded JSON FilterDefinition",
    );
  }
};

/**
 * Decodes the `{ "<column>": [values] }` filter format some list operations
 * accept (base64 JSON) into an AND of `_in` filters. Empty lists are
 * ignored. Throws BadRequest for anything else.
 */
export const parseInFilters = (
  filters: string | undefined,
): FilterDefinition | undefined => {
  if (!filters) {
    return undefined;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(filters, "base64").toString("utf-8"));
  } catch {
    throw new BadRequestException("`filters` must be base64-encoded JSON");
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new BadRequestException("`filters` must be a JSON object");
  }

  const clauses: FilterDefinition[] = [];
  for (const [field, values] of Object.entries(decoded)) {
    assertField(field, "filter field");
    const allStrings =
      Array.isArray(values) && values.every((v) => typeof v === "string");
    const allNumbers =
      Array.isArray(values) && values.every((v) => typeof v === "number");
    if (!allStrings && !allNumbers) {
      throw new BadRequestException(`Invalid values for filter "${field}"`);
    }
    if (values.length > 0) {
      clauses.push({
        type: FilterType.IN,
        name: field,
        value: values as string[] | number[],
      });
    }
  }

  return clauses.length > 0
    ? { type: FilterType.AND, name: "_", value: clauses }
    : undefined;
};

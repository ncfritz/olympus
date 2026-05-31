import { ApiProperty, getSchemaPath } from "@nestjs/swagger";

export enum FilterType {
  AND = "and",
  OR = "or",
  NOT = "not",
  EQUALS = "eq",
  EXISTS = "exists",
  GREATER_THAN = "gt",
  GREATER_THAN_EQUAL = "gte",
  LIKE_IGNORE_CASE = "ilike",
  IN = "in",
  REGEX_IGNORE_CASE = "iregex",
  IS_NULL = "is_null",
  LIKE = "like",
  LESS_THAN = "lt",
  LESS_THAN_EQUAL = "lte",
  NOT_EQUAL = "neq",
  NOT_LIKE_IGNORE_CASE = "nilike",
  NOT_IN = "nin",
  NOT_REGEX_IGNORE_CASE = "niregex",
  NOT_LIKE = "nlike",
  NOT_REGEX = "nregex",
  NOT_SIMILAR = "nsimilar",
  REGEX = "regex",
  SIMILAR = "similar",
}

export class FilterDefinition {
  @ApiProperty({ enum: () => FilterType, enumName: "FilterType" })
  type: FilterType;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({
    type: () => Object,
    oneOf: [
      { $ref: getSchemaPath(FilterDefinition) },
      { type: "array", items: { $ref: getSchemaPath(FilterDefinition) } },
      { type: "number" },
      { type: "array", items: { type: "number" } },
      { type: "string" },
      { type: "array", items: { type: "string" } },
      { type: "boolean" },
    ],
    description:
      "A filter definition, which may contain a nested hierarchy of additional FilterDefinitions",
  })
  value:
    | FilterDefinition
    | FilterDefinition[]
    | number[]
    | number
    | string[]
    | string
    | boolean;
}

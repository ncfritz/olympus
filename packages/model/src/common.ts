import { ApiProperty } from "@nestjs/swagger";

export enum SortDirection {
  ASC = "asc",
  ASC_NULL_FIRST = "asc_nulls_first",
  ASC_NULL_LAST = "asc_nulls_last",
  DESC = "desc",
  DESC_NULL_FIRST = "desc_nulls_first",
  DESC_NULL_LAST = "desc_nulls_last",
}

export class EmptyResponse {}

export class PaginatedResults {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The total number of matching items across all pages",
  })
  count: number;
}

export class SystemConfiguration {
  @ApiProperty({
    type: String,
    required: true,
    description: "The Hasura host the API is configured to use",
  })
  "hasura.host": string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The RabbitMQ host the API is configured to use",
  })
  "amqp.host": string;
}

export class PingResponse {
  @ApiProperty({
    required: true,
    type: () => SystemConfiguration,
    description: "The API's effective configuration",
  })
  config: SystemConfiguration;
}

export class TestRequest {
  @ApiProperty({
    required: true,
    type: () => Object,
    description: "The message payload to publish",
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- arbitrary payload echoed by the AMQP test endpoint
  payload: any;
}

/**
 * Server-managed audit timestamps. Omit them when deriving create/update
 * shapes: `OmitType(Entity, [...AUDIT_FIELDS, "otherField"])`.
 */
export const AUDIT_FIELDS = ["createdTime", "lastUpdatedTime"] as const;

/* ------------------------------------------------------------------------------------------------------------------ */
/* Chart data                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------------ */

/** OpenAPI schema for `number[]`, for use in `items` / `additionalProperties`. */
export const NUMBER_ARRAY_SCHEMA = {
  type: "array",
  items: { type: "number" },
} as const;

/** OpenAPI schema for `number[][]` (e.g. [timestamp, value] pairs). */
export const NUMBER_MATRIX_SCHEMA = {
  type: "array",
  items: NUMBER_ARRAY_SCHEMA,
} as const;

/** One named series of values for a chart. */
export class ChartSeries {
  @ApiProperty({
    type: String,
    required: true,
    description: "The name of the series",
  })
  name: string;

  @ApiProperty({
    type: Number,
    isArray: true,
    required: true,
    description: "The values of the series, one per category",
  })
  data: number[];

  @ApiProperty({
    type: String,
    required: false,
    description: "The chart type used to render the series",
  })
  type?: string;
}

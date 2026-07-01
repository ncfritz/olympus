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
  @ApiProperty({ type: Number })
  count: number;
}

export class SystemConfiguration {
  @ApiProperty({ type: String })
  "hasura.host": string;
}

export class PingResponse {
  @ApiProperty({ type: () => SystemConfiguration })
  config: Record<string, string>;
}

export class TestRequest {
  @ApiProperty({ type: () => Object })
  payload: any;
}

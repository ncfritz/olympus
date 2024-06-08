import { ApiProperty } from "@nestjs/swagger";

export enum SortDirection {
  ASC = "asc",
  DESC = "desc",
}

export class EmptyResponse {}

export class PaginatedResults {
  @ApiProperty({ type: Number })
  count: number;
}

export class PingResponse {
  @ApiProperty({ additionalProperties: { type: "string" } })
  config: Record<string, string>;
}

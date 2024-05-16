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

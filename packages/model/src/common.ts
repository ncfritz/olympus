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

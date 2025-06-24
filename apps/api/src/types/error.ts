import { HttpStatus } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponse {
  @ApiProperty({ type: () => String })
  public message: string;

  @ApiProperty({ type: () => Number })
  public statusCode: HttpStatus;
}

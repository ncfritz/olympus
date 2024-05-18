import { HttpStatus } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponse {
  @ApiProperty({ type: () => Number })
  public errorCode: HttpStatus;

  @ApiProperty({ type: () => String })
  public message: string;
}

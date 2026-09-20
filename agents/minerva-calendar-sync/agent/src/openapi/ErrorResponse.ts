import type { HttpStatus } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

/** The body of an error answer (Nest's HTTP exceptions), as in the Olympus API. */
export class ErrorResponse {
  @ApiProperty({
    type: String,
    required: true,
    description: "What went wrong",
  })
  message: string | string[];

  @ApiProperty({
    type: Number,
    required: true,
    description: "The HTTP status code",
  })
  statusCode: HttpStatus;
}

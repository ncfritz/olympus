import { ApiProperty } from "@nestjs/swagger";

export class CheckAuthResponse {
  @ApiProperty({ type: Boolean, required: true })
  authorized: boolean;
}

export class VerifyAuthResponse {
  @ApiProperty({ type: Boolean, required: true })
  authorized: boolean;
}
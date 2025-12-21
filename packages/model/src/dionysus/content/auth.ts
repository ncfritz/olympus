import { ApiProperty } from "@nestjs/swagger";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CheckAuthResponse {
  @ApiProperty({
    type: Boolean,
    required: true,
    description: "`true` if the user is authorized to access Dionysus",
  })
  authorized: boolean;
}

export class VerifyAuthResponse {
  @ApiProperty({
    type: Boolean,
    required: true,
    description: "`true` if the user is authorized to access Dionysus",
  })
  authorized: boolean;
}

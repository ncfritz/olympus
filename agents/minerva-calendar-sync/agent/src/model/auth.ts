import { ApiProperty } from "@nestjs/swagger";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The signed-in user. */
export class CurrentUser {
  @ApiProperty({
    type: String,
    required: true,
    description: "The user's verified email address",
  })
  email: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class DescribeCurrentUserResponse {
  @ApiProperty({
    type: () => CurrentUser,
    required: true,
    description: "The signed-in user.",
  })
  user: CurrentUser;
}

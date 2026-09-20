import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

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
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class RefreshAccessTokenRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The refresh token issued at sign-in",
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
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

export class RefreshAccessTokenResponse {
  @ApiProperty({
    type: String,
    required: true,
    description: "A new access token, for the Authorization header",
  })
  accessToken: string;
}

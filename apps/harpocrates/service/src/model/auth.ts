import { ApiProperty } from "@nestjs/swagger";
import { PkiRole } from "../auth/principal";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The signed-in user, as the CA console shows them. */
export class CurrentUser {
  @ApiProperty({
    type: String,
    required: true,
    description: "The user's verified email address, from the Olympus API",
  })
  email: string;

  @ApiProperty({
    enum: PkiRole,
    enumName: "PkiRole",
    isArray: true,
    required: true,
    description:
      "The user's Harpocrates roles, from their access token; none means they may sign in but do nothing here",
  })
  roles: PkiRole[];
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

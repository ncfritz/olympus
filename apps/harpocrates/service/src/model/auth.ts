import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
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

/** Who a recorded principal is: an Olympus user Harpocrates has seen. */
export class KnownPrincipal {
  @ApiProperty({
    type: String,
    required: true,
    description: "The principal as Harpocrates records it: user:<id>",
  })
  principal: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Their email, as the Olympus API last described them",
  })
  email: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when they were first seen",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when they were last described",
  })
  updatedAt: Moment;
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

export class ListPrincipalsResponse {
  @ApiProperty({
    type: () => KnownPrincipal,
    isArray: true,
    required: true,
    description: "The users seen, by email",
  })
  principals: KnownPrincipal[];
}

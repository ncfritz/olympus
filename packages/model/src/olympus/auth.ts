import { ApiProperty } from "@nestjs/swagger";
import { Moment } from "moment";
import { ApiTimestamp } from "../decorators";

/**
 * One public key, in the JSON Web Key shape RFC 7517 defines. Only the
 * fields an ES256 verifier needs: no private material ever appears here.
 *
 * Not called `JsonWebKey`: that is a global type in both lib.dom and Node's
 * webcrypto typings, and a class exported under that name shadows it for
 * every consumer of this package.
 */
export class PublicSigningKey {
  @ApiProperty({
    type: String,
    required: true,
    description: "Key type. Always `EC` for the ES256 keys the API signs with",
    example: "EC",
  })
  kty: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The curve",
    example: "P-256",
  })
  crv: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The public point's x coordinate, base64url",
  })
  x: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The public point's y coordinate, base64url",
  })
  y: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The algorithm this key is for",
    example: "ES256",
  })
  alg: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "What the key is for",
    example: "sig",
  })
  use: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "Key identifier: the RFC 7638 thumbprint of this key, which is what an access token's `kid` header names",
  })
  kid: string;
}

/** The key set a client verifies the API's access tokens against. */
export class DescribeJsonWebKeySetResponse {
  @ApiProperty({
    type: () => [PublicSigningKey],
    required: true,
    description:
      "Every key the API currently verifies with, newest last. A token outlives a rotation because its `kid` names the key that signed it",
  })
  keys: PublicSigningKey[];
}

/**
 * An OAuth token response (RFC 6749 §5.1).
 *
 * The field names are snake_case because the specification says so and
 * every client library expects it — the one place in this model package
 * where the house camelCase gives way to an external contract.
 */
export class CreateTokenResponse {
  @ApiProperty({
    type: String,
    required: true,
    description: "The access token: a JWT, signed ES256, good for ten minutes",
  })
  access_token: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Always `Bearer`",
    example: "Bearer",
  })
  token_type: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Seconds until the access token expires",
    example: 600,
  })
  expires_in: number;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The refresh token, for a client that receives it in the body. Absent for the site, which is given it in an httpOnly cookie instead so that it never reaches JavaScript",
  })
  refresh_token?: string;
}

/**
 * The signed-in user, as they are *now* rather than as their token says.
 *
 * Roles are in the access token too, and they can disagree: a token is good
 * for ten minutes, so one issued before a role change still carries the old
 * set. This is the authoritative answer, which is why a client that wants
 * to decide what to show reads it here rather than decoding the token.
 */
export class CurrentUser {
  @ApiProperty({
    type: String,
    required: true,
    description: "The user's id",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The name to show for them",
  })
  displayName: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "Their email address, in the casing they were created with. Addresses are matched case-insensitively, so this is for display and not a key",
  })
  email: string;

  @ApiProperty({
    type: [String],
    required: true,
    description:
      "The roles they hold now. May differ from the `roles` claim in a token issued before they last changed",
  })
  roles: string[];
}

/** Who the request is from. */
export class DescribeCurrentUserResponse {
  @ApiProperty({
    type: () => CurrentUser,
    required: true,
    description: "The signed-in user",
  })
  user: CurrentUser;
}

/**
 * One of a user's live sessions: a sign-in on one client, which a refresh
 * token keeps alive.
 *
 * Nothing here identifies the refresh token. The session id is safe to hand
 * out — revoking by it is scoped to the owner — but the token itself, and
 * its hash, never leave the API.
 */
export class UserSession {
  @ApiProperty({
    type: String,
    required: true,
    description: "The session's id, which is what RevokeSession takes",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The client this session was created for, e.g. `olympus-site`",
  })
  clientId: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "What the client called the device when it signed in. Absent where it did not say",
  })
  deviceName?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether this is the session the request was made from — the `sid` in the caller's own access token. Revoking it signs this device out",
  })
  current: boolean;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the sign-in completed. Unchanged when the refresh token rotates",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the session last refreshed. Absent until it has",
  })
  lastUsedTime?: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the session expires and signing in again is needed",
  })
  expiresTime: Moment;
}

/** A user's live sessions. */
export class ListSessionsResponse {
  @ApiProperty({
    type: () => [UserSession],
    required: true,
    description:
      "Every session of the signed-in user that has not been revoked or expired, newest first",
  })
  sessions: UserSession[];
}

/** What revoking a session did. */
export class RevokeSessionResponse {
  @ApiProperty({
    type: String,
    required: true,
    description: "The session that was revoked",
  })
  sessionId: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the caller revoked the session it was calling from. When true the client's own tokens are now dead and it should discard them and sign in again",
  })
  signedOutThisDevice: boolean;
}

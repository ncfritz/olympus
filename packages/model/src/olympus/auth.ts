import { ApiProperty } from "@nestjs/swagger";

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

import { ApiProperty } from "@nestjs/swagger";

/**
 * One public key, in the JSON Web Key shape RFC 7517 defines. Only the
 * fields an ES256 verifier needs: no private material ever appears here.
 */
export class JsonWebKey {
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
    type: () => [JsonWebKey],
    required: true,
    description:
      "Every key the API currently verifies with, newest last. A token outlives a rotation because its `kid` names the key that signed it",
  })
  keys: JsonWebKey[];
}

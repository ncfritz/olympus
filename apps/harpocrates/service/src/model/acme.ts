import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";

export const ACME_ACCOUNT_STATUS_VALUES = [
  "valid",
  "deactivated",
  "revoked",
] as const;
export type AcmeAccountStatusName = (typeof ACME_ACCOUNT_STATUS_VALUES)[number];

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The DNS names an EAB credential's account may request. */
export class AcmeNames {
  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "Names it may request exactly",
    example: ["nas.internal.ncfritz.net"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  exact?: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "Names it may request with every name below them",
    example: ["lab.internal.ncfritz.net"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  subtrees?: string[];
}

/** The ACME account a credential was bound to. */
export class AcmeAccountSummary {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({
    enum: [...ACME_ACCOUNT_STATUS_VALUES],
    enumName: "AcmeAccountStatus",
    required: true,
    description: "valid, deactivated (by its client) or revoked (here)",
  })
  status: AcmeAccountStatusName;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The contact URIs its client gave",
  })
  contacts: string[];

  @ApiProperty({
    type: String,
    required: true,
    description: "Its key's RFC 7638 thumbprint, base64url",
  })
  keyThumbprint: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it registered",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/**
 * An External Account Binding credential (ADR 0020, ACME): what lets an
 * ACME client register, and which names its account may request.
 */
export class AcmeCredential {
  @ApiProperty({
    type: String,
    required: true,
    description: "Its key id, which the ACME client is given (--eab-kid)",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "What it is for: the host or the client that holds it",
  })
  label: string;

  @ApiProperty({
    type: () => AcmeNames,
    required: true,
    description: "The names its account may request",
  })
  names: AcmeNames;

  @ApiProperty({
    type: String,
    required: true,
    description: "Who made it",
  })
  principal: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when an account bound it, which erased its key",
  })
  boundAt?: Moment;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it was revoked",
  })
  revokedAt?: Moment;

  @ApiProperty({
    type: () => AcmeAccountSummary,
    required: false,
    description: "The account it was bound to",
  })
  account?: AcmeAccountSummary;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was made",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateAcmeCredentialRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "What it is for: the host or the client that will hold it",
    example: "Caddy on furball",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiProperty({
    type: () => AcmeNames,
    required: true,
    description: "The names its account may request: at least one",
  })
  @ValidateNested()
  @Type(() => AcmeNames)
  names: AcmeNames;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateAcmeCredentialResponse {
  @ApiProperty({
    type: () => AcmeCredential,
    required: true,
    description: "The credential",
  })
  credential: AcmeCredential;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "Its HMAC key, base64url (--eab-hmac-key): shown this once, and erased when an account binds it",
  })
  hmacKey: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ACME directory the client registers at",
  })
  directoryUrl: string;
}

export class ListAcmeCredentialsResponse {
  @ApiProperty({
    type: () => AcmeCredential,
    isArray: true,
    required: true,
    description: "Every credential, newest first",
  })
  credentials: AcmeCredential[];
}

export class RevokeAcmeCredentialResponse {
  @ApiProperty({
    type: () => AcmeCredential,
    required: true,
    description: "The credential, revoked, with its account",
  })
  credential: AcmeCredential;
}

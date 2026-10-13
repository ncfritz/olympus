import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";

export const ACME_ACCOUNT_STATUS_VALUES = [
  "valid",
  "deactivated",
  "revoked",
] as const;
export type AcmeAccountStatusName = (typeof ACME_ACCOUNT_STATUS_VALUES)[number];

export const ACME_ORDER_STATUS_VALUES = [
  "pending",
  "ready",
  "processing",
  "valid",
  "invalid",
] as const;
export type AcmeOrderStatusName = (typeof ACME_ORDER_STATUS_VALUES)[number];

export const ACME_AUTHORIZATION_STATUS_VALUES = [
  "pending",
  "valid",
  "invalid",
  "deactivated",
  "expired",
  "revoked",
] as const;
export type AcmeAuthorizationStatusName =
  (typeof ACME_AUTHORIZATION_STATUS_VALUES)[number];

export const ACME_CHALLENGE_STATUS_VALUES = [
  "pending",
  "processing",
  "valid",
  "invalid",
] as const;
export type AcmeChallengeStatusName =
  (typeof ACME_CHALLENGE_STATUS_VALUES)[number];

export const ACME_CHALLENGE_TYPE_VALUES = ["http-01", "tls-alpn-01"] as const;
export type AcmeChallengeTypeName = (typeof ACME_CHALLENGE_TYPE_VALUES)[number];

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

/** A challenge a client answered, for one name of an order. */
export class AcmeChallengeSummary {
  @ApiProperty({
    enum: [...ACME_CHALLENGE_TYPE_VALUES],
    enumName: "AcmeChallengeType",
    required: true,
    description: "http-01 or tls-alpn-01",
  })
  type: AcmeChallengeTypeName;

  @ApiProperty({
    enum: [...ACME_CHALLENGE_STATUS_VALUES],
    enumName: "AcmeChallengeStatus",
    required: true,
    description: "processing (being checked), valid or invalid",
  })
  status: AcmeChallengeStatusName;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it was proved",
  })
  validatedAt?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Why it failed: an ACME error type, without urn:ietf:params:acme:error:",
    example: "connection",
  })
  errorType?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why it failed, as the check said it",
  })
  errorDetail?: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was offered",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/** One name of an order, and how it was proved. */
export class AcmeAuthorizationSummary {
  @ApiProperty({
    type: String,
    required: true,
    description: "The DNS name",
  })
  identifier: string;

  @ApiProperty({
    enum: [...ACME_AUTHORIZATION_STATUS_VALUES],
    enumName: "AcmeAuthorizationStatus",
    required: true,
    description: "Whether the name is proved",
  })
  status: AcmeAuthorizationStatusName;

  @ApiProperty({
    type: () => AcmeChallengeSummary,
    isArray: true,
    required: true,
    description:
      "The challenges its client answered (none, if it answered none)",
  })
  challenges: AcmeChallengeSummary[];

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

/** An ACME order, from its creation to its certificate or its failure. */
export class AcmeOrderSummary {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The credential of the account that placed it",
  })
  credentialId: string;

  @ApiProperty({
    enum: [...ACME_ORDER_STATUS_VALUES],
    enumName: "AcmeOrderStatus",
    required: true,
    description:
      "pending (names to prove), ready (to finalize), processing, valid (issued) or invalid (failed or expired)",
  })
  status: AcmeOrderStatusName;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The DNS names it is for",
  })
  identifiers: string[];

  @ApiProperty({
    type: () => AcmeAuthorizationSummary,
    isArray: true,
    required: true,
    description: "Each name, and how it was proved",
  })
  authorizations: AcmeAuthorizationSummary[];

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Why it is invalid: an ACME error type, without urn:ietf:params:acme:error:",
    example: "connection",
  })
  errorType?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why it is invalid",
  })
  errorDetail?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The certificate finalizing it issued",
  })
  certificateId?: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when its certificate was issued",
  })
  issuedAt?: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was placed",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/** A certificate an ACME client holds, and when its client should renew it. */
export class AcmeClientCertificate {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  certificateId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The CA that issued it",
  })
  issuerId: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The names it was ordered for",
  })
  names: string[];

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it becomes valid",
  })
  notBefore: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it expires",
  })
  notAfter: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string: when its renewal window opens, as renewal information (RFC 9773) tells its client",
  })
  renewalStart: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when its renewal window closes",
  })
  renewalEnd: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was issued",
  })
  issuedAt: Moment;
}

/** An ACME client: its credential, what it holds, and its last order. */
export class AcmeClient {
  @ApiProperty({
    type: () => AcmeCredential,
    required: true,
    description: "Its credential, and the account bound with it",
  })
  credential: AcmeCredential;

  @ApiProperty({
    type: () => AcmeClientCertificate,
    isArray: true,
    required: true,
    description:
      "What it holds now: for each set of names it orders, its newest certificate, while valid; soonest to renew first",
  })
  certificates: AcmeClientCertificate[];

  @ApiProperty({
    type: () => AcmeOrderSummary,
    required: false,
    description: "The last order it placed",
  })
  lastOrder?: AcmeOrderSummary;
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

export class ListAcmeOrdersQuery {
  @ApiProperty({
    type: Number,
    required: false,
    description: "How many days back, to now (30 by default, at most 90)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
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

export class ListAcmeClientsResponse {
  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was read",
  })
  asOf: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description: "The ACME directory clients register at",
  })
  directoryUrl: string;

  @ApiProperty({
    type: () => AcmeClient,
    isArray: true,
    required: true,
    description: "Every client, newest credential first",
  })
  clients: AcmeClient[];
}

export class ListAcmeOrdersResponse {
  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was read",
  })
  asOf: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string: the start of the days asked for",
  })
  since: Moment;

  @ApiProperty({
    type: () => AcmeOrderSummary,
    isArray: true,
    required: true,
    description: "Every order placed since then, newest first",
  })
  orders: AcmeOrderSummary[];
}

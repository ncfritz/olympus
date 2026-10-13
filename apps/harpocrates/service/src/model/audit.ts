import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import type { Moment } from "moment";
import {
  AUDIT_ACTOR_VALUES,
  AUDIT_GROUP_VALUES,
  type AuditActorName,
  type AuditGroupName,
} from "../audit/auditGroups";

export const AUDIT_GROUP_ENUM = {
  enum: [...AUDIT_GROUP_VALUES],
  enumName: "AuditGroup",
  enumSchema: {
    description:
      "What an event concerns, from its kind: certificates, cas, ceremonies, keys, signer, lists, ocsp, acme, deploy, profiles, ssh, refused (a request refused) or other",
  },
};

export const AUDIT_ACTOR_ENUM = {
  enum: [...AUDIT_ACTOR_VALUES],
  enumName: "AuditActor",
  enumSchema: {
    description:
      "Who acted: people (users and the CLI), system (Harpocrates itself), acme (ACME accounts) or holders (renewing over mTLS)",
  },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class AuditAttribute {
  @ApiProperty({ type: String, required: true, description: "Its name" })
  name: string;

  @ApiProperty({ type: String, required: true, description: "Its value" })
  value: string;
}

/** One entry of the append-only, hash-chained audit log. */
export class AuditEvent {
  @ApiProperty({
    type: String,
    required: true,
    description: "Its position in the chain",
  })
  sequence: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it happened",
  })
  occurredAt: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description: "What happened, e.g. certificate.issued",
  })
  kind: string;

  @ApiProperty({
    ...AUDIT_GROUP_ENUM,
    required: true,
    description: "What it concerns, from its kind",
  })
  group: AuditGroupName;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether it is sensitive: a key exported or imported, the seal, a ceremony, a revocation, a request refused",
  })
  sensitive: boolean;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "Who: user:<id> (GET /principals names them), cli:<name>, acme:<account>, certificate:<serial> or system",
  })
  principal: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Where from: api, cli, acme, renewal or system",
  })
  surface: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The kind of thing it concerns: issuer, certificate, key",
  })
  subjectType?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The ID of the thing it concerns",
  })
  subjectId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "What it concerns, by name: a certificate's or CA's common name, a deploy target's name",
  })
  subjectName?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The reason given, where one is required",
  })
  reason?: string;

  @ApiProperty({
    type: () => AuditAttribute,
    isArray: true,
    required: true,
    description: "Its details",
  })
  attributes: AuditAttribute[];

  @ApiProperty({
    type: String,
    required: true,
    description: "Its hash, which the next event's covers",
  })
  hash: string;
}

/** Whether the chain holds. */
export class AuditVerification {
  @ApiProperty({
    type: Number,
    required: true,
    description: "How many events verified",
  })
  events: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether every event's hash and link hold",
  })
  valid: boolean;

  @ApiProperty({
    type: String,
    required: false,
    description: "The first event that does not hold",
  })
  brokenAt?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListAuditEventsQuery {
  @ApiProperty({
    type: String,
    required: false,
    description: "Only this kind",
  })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Only this principal",
  })
  @IsOptional()
  @IsString()
  principal?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Only events about this kind of thing",
  })
  @IsOptional()
  @IsString()
  subjectType?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Only events about this thing",
  })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Only events in these groups, comma-separated (certificates,keys)",
  })
  @IsOptional()
  @Matches(
    new RegExp(
      `^(${AUDIT_GROUP_VALUES.join("|")})(,(${AUDIT_GROUP_VALUES.join("|")}))*$`,
    ),
    {
      message: `groups is a comma-separated list of ${AUDIT_GROUP_VALUES.join(", ")}`,
    },
  )
  groups?: string;

  @ApiProperty({
    ...AUDIT_ACTOR_ENUM,
    required: false,
    description: "Only events by these",
  })
  @IsOptional()
  @IsIn([...AUDIT_ACTOR_VALUES])
  actor?: AuditActorName;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Only events from this surface: api, cli, acme, renewal or system",
  })
  @IsOptional()
  @IsString()
  surface?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Only sensitive events",
    enum: ["true", "false"],
  })
  @IsOptional()
  @IsIn(["true", "false"])
  sensitive?: "true" | "false";

  @ApiProperty({
    type: String,
    required: false,
    description: "An ISO-8601 formatted string: only events since then",
  })
  @IsOptional()
  @IsISO8601()
  since?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "Only events whose kind, principal, subject, reason or details contain this, in any case",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Events before this sequence: the next page",
  })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiProperty({
    type: Number,
    required: false,
    description: "How many, newest first (100 by default, at most 500)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListAuditEventsResponse {
  @ApiProperty({
    type: () => AuditEvent,
    isArray: true,
    required: true,
    description: "The events, newest first",
  })
  events: AuditEvent[];
}

export class GetAuditVerificationResponse {
  @ApiProperty({
    type: () => AuditVerification,
    required: true,
    description: "Whether the chain holds",
  })
  verification: AuditVerification;
}

/** One event, as the activity graphs draw it. */
export class AuditPoint {
  @ApiProperty({ type: String, required: true, description: "Its sequence" })
  sequence: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it happened",
  })
  occurredAt: Moment;

  @ApiProperty({ type: String, required: true, description: "Its kind" })
  kind: string;

  @ApiProperty({
    ...AUDIT_GROUP_ENUM,
    required: true,
    description: "What it concerns",
  })
  group: AuditGroupName;

  @ApiProperty({ type: String, required: true, description: "Its surface" })
  surface: string;

  @ApiProperty({ type: String, required: true, description: "Its principal" })
  principal: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is sensitive",
  })
  sensitive: boolean;
}

export class GetAuditActivityQuery {
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

export class GetAuditActivityResponse {
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
    type: () => AuditPoint,
    isArray: true,
    required: true,
    description: "Every event since then, oldest first",
  })
  points: AuditPoint[];
}

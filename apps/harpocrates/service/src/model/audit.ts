import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { Moment } from "moment";

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
    type: String,
    required: true,
    description: "Who: user:<id>, cli:<name> or system",
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

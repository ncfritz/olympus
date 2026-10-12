import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import {
  CERTIFICATE_STATE_ENUM,
  type CertificateStateName,
  REVOCATION_REASON_ENUM,
  type RevocationReasonName,
} from "./certificates";
import {
  CERTIFICATE_HEALTH_ENUM,
  type CertificateHealthName,
  RENEWAL_MODE_ENUM,
  type RenewalModeName,
  RENEWER_ENUM,
  type RenewerName,
} from "./dashboard";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Resources                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

/** One certificate of a lineage: a version of what its subject holds. */
export class LineageVersion {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  certificateId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The CA that issued it",
  })
  issuerId: string;

  @ApiProperty({ type: String, required: true, description: "Its serial, hex" })
  serial: string;

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
    description: "An ISO-8601 formatted string: when it was issued",
  })
  issuedAt: Moment;

  @ApiProperty({
    ...CERTIFICATE_STATE_ENUM,
    required: true,
    description: "Its state",
  })
  state: CertificateStateName;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it was revoked",
  })
  revokedAt?: Moment;

  @ApiProperty({
    ...REVOCATION_REASON_ENUM,
    required: false,
    description: "Why it was revoked",
  })
  revocationReason?: RevocationReasonName;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether it renews the version before it (renewed, or ordered again for the same subject); the first is new",
  })
  renews: boolean;
}

/**
 * A lineage: every certificate issued for one subject, linked by renewal,
 * or issued again by the same CA for the same subject; the newest is
 * what the subject holds now.
 */
export class CertificateLineage {
  @ApiProperty({
    type: String,
    required: true,
    description: "Its ID: its first version's",
  })
  lineageId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its newest version's common name, or its subject",
  })
  name: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "Its newest version's alternative names' values",
  })
  names: string[];

  @ApiProperty({
    type: String,
    required: true,
    description: "The CA that issued its newest version",
  })
  issuerId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The profile its newest version was issued under",
  })
  profileId?: string;

  @ApiProperty({
    ...CERTIFICATE_STATE_ENUM,
    required: true,
    description: "Its newest version's state",
  })
  state: CertificateStateName;

  @ApiProperty({
    ...CERTIFICATE_HEALTH_ENUM,
    required: false,
    description:
      "Whether its renewal is in hand, as the dashboard reads it; none once its newest version is revoked",
  })
  health?: CertificateHealthName;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string: its newest version's renewal point",
  })
  renewalDueAt: Moment;

  @ApiProperty({
    ...RENEWAL_MODE_ENUM,
    required: true,
    description: "Whether something renews it",
  })
  renewal: RenewalModeName;

  @ApiProperty({
    ...RENEWER_ENUM,
    required: true,
    description: "Who renews it",
  })
  renewer: RenewerName;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The deploy targets its newest version is deployed to",
  })
  deployTargets: string[];

  @ApiProperty({
    type: () => LineageVersion,
    isArray: true,
    required: true,
    description: "Its versions, newest first",
  })
  versions: LineageVersion[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListCertificateLineagesResponse {
  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when they were read",
  })
  asOf: Moment;

  @ApiProperty({
    type: () => CertificateLineage,
    isArray: true,
    required: true,
    description:
      "The lineages whose newest version is valid, or ended within the last year; soonest to expire first",
  })
  lineages: CertificateLineage[];
}

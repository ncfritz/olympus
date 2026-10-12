import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";

export const OCSP_RESPONDER_STATUS_VALUES = ["active", "superseded"] as const;
export type OcspResponderStatusName =
  (typeof OCSP_RESPONDER_STATUS_VALUES)[number];

export const OCSP_RESPONDER_STATUS_ENUM = {
  enum: [...OCSP_RESPONDER_STATUS_VALUES],
  enumName: "OcspResponderStatus",
  enumSchema: {
    description:
      "active: signs its CA's responses; superseded: replaced by a newer one, its key destroyed once it expires",
  },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A CA's OCSP responder (ADR 0036): a certificate the CA issued for an
 * `ocsp` key in the signer, which signs that CA's responses.
 */
export class OcspResponder {
  @ApiProperty({ type: String, required: true, description: "Its id" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The CA it answers for, which issued it",
  })
  issuerId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its certificate's serial, hex",
  })
  serial: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its certificate's subject",
  })
  subject: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: valid from",
  })
  notBefore: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: valid until",
  })
  notAfter: Moment;

  @ApiProperty({
    ...OCSP_RESPONDER_STATUS_ENUM,
    required: true,
    description: "Whether it signs its CA's responses",
  })
  status: OcspResponderStatusName;

  @ApiProperty({
    type: String,
    required: false,
    description: "The ceremony it was issued in: an offline CA's",
  })
  ceremonyId?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its certificate, PEM",
  })
  certificate: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was issued",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/** How fresh a CA's stored responses are. */
export class OcspResponsesSummary {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Its stored responses, one per certificate and CertID hash",
  })
  count: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many say revoked",
  })
  revoked: number;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: the soonest any lapses; none are served after",
  })
  earliestNextUpdate?: Moment;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: the latest signed",
  })
  latestThisUpdate?: Moment;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListIssuerOcspRespondersResponse {
  @ApiProperty({
    type: () => OcspResponder,
    isArray: true,
    required: true,
    description: "Its responders, newest first",
  })
  responders: OcspResponder[];

  @ApiProperty({
    type: () => OcspResponsesSummary,
    required: true,
    description: "Its stored responses",
  })
  responses: OcspResponsesSummary;
}

export class IssueCeremonyOcspResponderResponse {
  @ApiProperty({
    type: () => OcspResponder,
    required: true,
    description: "The responder",
  })
  responder: OcspResponder;
}

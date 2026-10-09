import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import type { Moment } from "moment";

export const CRL_SOURCE_VALUES = ["signed", "ceremony", "imported"] as const;
export type CrlSourceName = (typeof CRL_SOURCE_VALUES)[number];

export const CRL_SOURCE_ENUM = {
  enum: [...CRL_SOURCE_VALUES],
  enumName: "CrlSource",
  enumSchema: {
    description:
      "Where a revocation list came from: signed by the signer for an online CA, in a ceremony by an offline CA's key, or imported",
  },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A revocation list (ADR 0020, Serials, revocation and publication). */
export class RevocationList {
  @ApiProperty({
    type: String,
    required: true,
    description: "The CA that signed it",
  })
  issuerId: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its CRL number: each of a CA's lists has a higher one",
  })
  number: number;

  @ApiProperty({
    ...CRL_SOURCE_ENUM,
    required: true,
    description: "Where it came from",
  })
  source: CrlSourceName;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was issued",
  })
  thisUpdate: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string: when it lapses; relying parties refuse everything below the CA after that",
  })
  nextUpdate: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many serials it lists",
  })
  entries: number;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when it was published and read back from the distribution URL",
  })
  publishedAt?: Moment;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many times publishing it has been tried",
  })
  publishAttempts: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why the last attempt to publish it failed",
  })
  lastError?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Where relying parties fetch the CA's current list",
  })
  url: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ImportIssuerCrlRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The list, PEM: signed by the CA elsewhere (XCA, an offline ceremony), with a number above any the CA has",
  })
  @IsString()
  @IsNotEmpty()
  crl: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListIssuerCrlsResponse {
  @ApiProperty({
    type: () => RevocationList,
    isArray: true,
    required: true,
    description: "The CA's lists, newest first",
  })
  crls: RevocationList[];
}

export class ImportIssuerCrlResponse {
  @ApiProperty({
    type: () => RevocationList,
    required: true,
    description: "The imported list, published with the next run",
  })
  crl: RevocationList;
}

export class SignCeremonyCrlResponse {
  @ApiProperty({
    type: () => RevocationList,
    required: true,
    description: "The offline CA's new list, published with the next run",
  })
  crl: RevocationList;
}

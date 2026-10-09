import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import type { Moment } from "moment";
import { CreatedOfflineIssuer, FullIssuer } from "./issuers";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** An offline CA's key, in the signer for this ceremony only (ADR 0020). */
export class Ceremony {
  @ApiProperty({
    type: String,
    required: true,
    description: "The ceremony's ID",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The offline CA whose key is held",
  })
  issuerId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Who opened it",
  })
  principal: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it opened",
  })
  openedAt: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when it closed (or timed out, as far as the service saw)",
  })
  closedAt?: Moment;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class OpenCeremonyRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The offline CA to open a ceremony for",
  })
  @IsString()
  @IsNotEmpty()
  issuerId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its key, encrypted PKCS#8, from offline media",
  })
  @IsString()
  @IsNotEmpty()
  privateKey: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The key's passphrase",
  })
  @IsString()
  @IsNotEmpty()
  passphrase: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class OpenCeremonyResponse {
  @ApiProperty({
    type: () => Ceremony,
    required: true,
    description: "The open ceremony",
  })
  ceremony: Ceremony;
}

export class DescribeCeremonyResponse {
  @ApiProperty({
    type: () => Ceremony,
    required: true,
    description: "The ceremony",
  })
  ceremony: Ceremony;
}

export class CreateIntermediateIssuerResponse extends CreatedOfflineIssuer {}

export class CreateIssuingIssuerResponse {
  @ApiProperty({
    type: () => FullIssuer,
    required: true,
    description: "The new issuing CA, registered with the signer",
  })
  issuer: FullIssuer;
}

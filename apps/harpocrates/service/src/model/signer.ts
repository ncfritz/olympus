import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export const SEAL_REASON_VALUES = [
  "uninitialised",
  "deliberate",
  "no-unseal-key",
  "wrong-unseal-key",
] as const;
export type SealReasonName = (typeof SEAL_REASON_VALUES)[number];

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The signer's seal (ADR 0020, Key protection). */
export class SignerStatus {
  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the signer's store is initialised",
  })
  initialised: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether it is sealed: nothing signs while it is",
  })
  sealed: boolean;

  @ApiProperty({
    enum: [...SEAL_REASON_VALUES],
    enumName: "SealReason",
    required: false,
    description: "Why it is sealed",
  })
  reason?: SealReasonName;

  @ApiProperty({
    type: String,
    required: false,
    description: "The signer's open ceremony, if any",
  })
  ceremonyId?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class InitialiseSignerRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The recovery passphrase to set, at least 12 characters: it unseals the signer after a deliberate seal or without the unseal key",
  })
  @IsString()
  @MinLength(12)
  passphrase: string;
}

export class UnsealSignerRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The recovery passphrase",
  })
  @IsString()
  @MinLength(12)
  passphrase: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class InitialiseSignerResponse {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The unseal key, base64, shown once: it becomes the harpocrates_signer_unseal_key secret, and goes in the password manager",
  })
  unsealKey: string;
}

export class DescribeSignerStatusResponse {
  @ApiProperty({
    type: () => SignerStatus,
    required: true,
    description: "The signer's seal",
  })
  status: SignerStatus;
}

import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, ValidateIf } from "class-validator";
import {
  KEY_ALGORITHM_ENUM,
  type KeyAlgorithmName,
  NAME_TYPE_ENUM,
  type NameTypeName,
} from "./common";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** What a certificate may be (ADR 0020, Profiles). */
export class Profile {
  @ApiProperty({
    type: String,
    required: true,
    description: "The profile's name, e.g. internal-tls",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "What it is for",
  })
  description: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The issuer it is pinned to; unset, the active issuing CA of its purpose",
  })
  issuerId?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The purpose of the issuing CA it issues from",
  })
  issuerPurpose: string;

  @ApiProperty({
    ...KEY_ALGORITHM_ENUM,
    required: true,
    description: "The key type its certificates certify",
  })
  keyAlgorithm: KeyAlgorithmName;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How long its certificates are valid, in days",
  })
  validityDays: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many days into a certificate's life it is renewed",
  })
  renewAtDays: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How old a key may be and still be renewed, in days",
  })
  maxKeyAgeDays: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether a subscriber may submit a CSR",
  })
  allowCsr: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the signer may generate (and escrow) the key",
  })
  allowGenerated: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether an escrowed key exports as legacy PKCS#12 (SHA-1, 3DES, no chain)",
  })
  legacyExport: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether a certificate needs at least one alternative name",
  })
  requireSan: boolean;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "Its key usages",
  })
  keyUsages: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "Its extended key usages, dotted OIDs",
  })
  extendedKeyUsages: string[];

  @ApiProperty({
    ...NAME_TYPE_ENUM,
    isArray: true,
    required: true,
    description: "The alternative name types it allows",
  })
  nameTypes: NameTypeName[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class UpdateProfileRequest {
  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description:
      "The issuer to pin it to; null to follow the active CA of its purpose",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{0,62}$/)
  issuerId?: string | null;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListProfilesResponse {
  @ApiProperty({
    type: () => Profile,
    isArray: true,
    required: true,
    description: "Every profile",
  })
  profiles: Profile[];
}

export class DescribeProfileResponse {
  @ApiProperty({
    type: () => Profile,
    required: true,
    description: "The profile",
  })
  profile: Profile;
}

export class UpdateProfileResponse {
  @ApiProperty({
    type: () => Profile,
    required: true,
    description: "The profile, updated",
  })
  profile: Profile;
}

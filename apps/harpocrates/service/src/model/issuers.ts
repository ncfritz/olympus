import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";
import {
  KEY_ALGORITHM_ENUM,
  KEY_ALGORITHM_VALUES,
  type KeyAlgorithmName,
  NameConstraints,
} from "./common";

export const ISSUER_TIER_VALUES = ["root", "intermediate", "issuing"] as const;
export type IssuerTierName = (typeof ISSUER_TIER_VALUES)[number];

export const ISSUER_TIER_ENUM = {
  enum: [...ISSUER_TIER_VALUES],
  enumName: "IssuerTier",
  enumSchema: {
    description:
      "A CA's tier: roots and intermediates are offline, issuing CAs online",
  },
};

export const ISSUER_STATUS_VALUES = [
  "pending",
  "active",
  "closed",
  "revoked",
] as const;
export type IssuerStatusName = (typeof ISSUER_STATUS_VALUES)[number];

export const ISSUER_STATUS_ENUM = {
  enum: [...ISSUER_STATUS_VALUES],
  enumName: "IssuerStatus",
  enumSchema: {
    description:
      "Whether a CA signs: pending (no certificate yet), active, closed (nothing new) or revoked",
  },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A certificate authority (ADR 0020, Hierarchy). */
export class Issuer {
  @ApiProperty({
    type: String,
    required: true,
    description: "The CA's slug, e.g. tls-issuing-1-g1",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The CA's subject, RFC 4514",
  })
  subject: string;

  @ApiProperty({
    ...ISSUER_TIER_ENUM,
    required: true,
    description: "The CA's tier",
  })
  tier: IssuerTierName;

  @ApiProperty({
    ...ISSUER_STATUS_ENUM,
    required: true,
    description: "Whether the CA signs",
  })
  status: IssuerStatusName;

  @ApiProperty({
    type: String,
    required: false,
    description: "What an issuing CA is for: TLS, Service, Device, Signing",
  })
  purpose?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Tells apart CAs of the same purpose and tier",
  })
  number: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Counts successors: a successor keeps the number",
  })
  generation: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The CA that signed this one, when it is in Harpocrates",
  })
  parentId?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether its key is offline (roots and intermediates) rather than in the signer",
  })
  offline: boolean;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when the CA's validity starts",
  })
  notBefore?: Moment;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when the CA expires",
  })
  notAfter?: Moment;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when the CA stops issuing, because its longest certificate would no longer fit",
  })
  issuingWindowClosesAt?: Moment;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Its path length constraint",
  })
  pathLength?: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longest certificate it signs, in days",
  })
  maxValidityDays: number;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "The extended key usages it may sign, as dotted OIDs; empty means not restricted",
  })
  extendedKeyUsages: string[];

  @ApiProperty({
    type: () => NameConstraints,
    required: true,
    description: "Its name constraints",
  })
  nameConstraints: NameConstraints;

  @ApiProperty({
    type: String,
    required: true,
    description: "Where its revocation list is published",
  })
  crlUrl: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Where its certificate is published",
  })
  caIssuersUrl: string;
}

/** A CA with its certificate and the chain above it. */
export class FullIssuer extends Issuer {
  @ApiProperty({
    type: String,
    required: false,
    description: "Its certificate, PEM",
  })
  certificate?: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The certificates above it, PEM, nearest first",
  })
  chain: string[];
}

/** A new offline CA, with its key: shown once, to be stored offline. */
export class CreatedOfflineIssuer {
  @ApiProperty({
    type: () => FullIssuer,
    required: true,
    description: "The new CA",
  })
  issuer: FullIssuer;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "Its private key, encrypted PKCS#8 under the export passphrase: store it on offline media and in the password manager. Harpocrates keeps no copy.",
  })
  encryptedKey: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateRootIssuerRequest {
  @ApiProperty({
    type: Number,
    required: true,
    description: "The root's number, 1 for the first",
  })
  @IsInt()
  @Min(1)
  number: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its generation, 1 unless it succeeds a root",
  })
  @IsInt()
  @Min(1)
  generation: number;

  @ApiProperty({
    ...KEY_ALGORITHM_ENUM,
    required: false,
    description: "The root's key type (P-256 by default)",
  })
  @IsOptional()
  @IsIn([...KEY_ALGORITHM_VALUES])
  algorithm?: KeyAlgorithmName;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The passphrase the root's key is exported under, at least 12 characters",
  })
  @IsString()
  @MinLength(12)
  exportPassphrase: string;
}

export class CreateIntermediateIssuerRequest extends CreateRootIssuerRequest {
  @ApiProperty({
    type: () => NameConstraints,
    required: false,
    description: "Name constraints for the intermediate",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NameConstraints)
  nameConstraints?: NameConstraints;
}

export class CreateIssuingIssuerRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "What it is for: TLS, Service, Device, Signing",
  })
  @IsString()
  @Matches(/^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/)
  purpose: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its number among CAs of the same purpose",
  })
  @IsInt()
  @Min(1)
  number: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its generation, 1 unless it succeeds a CA",
  })
  @IsInt()
  @Min(1)
  generation: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longest certificate it may sign, in days",
  })
  @IsInt()
  @Min(1)
  @Max(3650)
  maxValidityDays: number;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "The extended key usages it may sign, dotted OIDs; written into its certificate",
  })
  @IsArray()
  @IsString({ each: true })
  extendedKeyUsages: string[];

  @ApiProperty({
    type: () => NameConstraints,
    required: false,
    description: "Its name constraints",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NameConstraints)
  nameConstraints?: NameConstraints;
}

export class ImportIssuerRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The slug to know it by, e.g. services-xca",
  })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{0,62}$/)
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its certificate, PEM",
  })
  @IsString()
  @IsNotEmpty()
  certificate: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "The certificates above it, PEM, nearest first; each must be in Harpocrates already, or be the root",
  })
  @IsArray()
  @IsString({ each: true })
  chain: string[];

  @ApiProperty({
    ...ISSUER_TIER_ENUM,
    required: true,
    description: "Its tier: roots and intermediates are imported offline",
  })
  @IsIn([...ISSUER_TIER_VALUES])
  tier: IssuerTierName;

  @ApiProperty({
    type: String,
    required: false,
    description: "What an issuing CA is for",
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its number",
  })
  @IsInt()
  @Min(1)
  number: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its generation",
  })
  @IsInt()
  @Min(1)
  generation: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longest certificate it may sign, in days",
  })
  @IsInt()
  @Min(1)
  maxValidityDays: number;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The extended key usages it may sign, dotted OIDs",
  })
  @IsArray()
  @IsString({ each: true })
  extendedKeyUsages: string[];

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An issuing CA's key, encrypted PKCS#8 (as XCA exports it); offline CAs are imported without one",
  })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The key's passphrase",
  })
  @IsOptional()
  @IsString()
  passphrase?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListIssuersResponse {
  @ApiProperty({
    type: () => Issuer,
    isArray: true,
    required: true,
    description: "Every CA, parents before children",
  })
  issuers: Issuer[];
}

export class DescribeIssuerResponse {
  @ApiProperty({
    type: () => FullIssuer,
    required: true,
    description: "The CA",
  })
  issuer: FullIssuer;
}

export class CreateRootIssuerResponse extends CreatedOfflineIssuer {}

export class ImportIssuerResponse {
  @ApiProperty({
    type: () => FullIssuer,
    required: true,
    description: "The imported CA",
  })
  issuer: FullIssuer;
}

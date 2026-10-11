import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";

/*
 * Schema pieces shared by the management API's shapes (see
 * docs/conventions/model.md). Enums are string-literal arrays; each is one
 * named schema, described once.
 */

export const NAME_TYPE_VALUES = [
  "dns",
  "ip",
  "email",
  "uri",
  "upn",
  "registeredId",
] as const;
export type NameTypeName = (typeof NAME_TYPE_VALUES)[number];

export const NAME_TYPE_ENUM = {
  enum: [...NAME_TYPE_VALUES],
  enumName: "NameType",
  enumSchema: {
    description:
      "A kind of name: DNS, IP address, email, URI, a Microsoft user principal name (otherName) or a registeredID (an OID)",
  },
};

/** The name types with subtrees (RFC 5280, 4.2.1.10): constraints, policies. */
export const SUBTREE_NAME_TYPE_VALUES = ["dns", "ip", "email", "uri"] as const;
export type SubtreeNameTypeName = (typeof SUBTREE_NAME_TYPE_VALUES)[number];

export const SUBTREE_NAME_TYPE_ENUM = {
  enum: [...SUBTREE_NAME_TYPE_VALUES],
  enumName: "SubtreeNameType",
  enumSchema: {
    description: "A kind of name with subtrees: DNS, IP address, email or URI",
  },
};

/** A dotted OID. */
export const OID = /^[0-2](\.(0|[1-9][0-9]*))+$/;

/** A user principal name: user@domain. */
export const UPN = /^[^@\s]+@[^@\s]+$/;

export const KEY_ALGORITHM_VALUES = [
  "RSA-2048",
  "RSA-3072",
  "RSA-4096",
  "RSA-8192",
  "DSA-2048",
  "DSA-3072",
  "P-256",
  "P-384",
  "P-521",
  "Ed25519",
] as const;
export type KeyAlgorithmName = (typeof KEY_ALGORITHM_VALUES)[number];

export const KEY_ALGORITHM_ENUM = {
  enum: [...KEY_ALGORITHM_VALUES],
  enumName: "KeyAlgorithm",
  enumSchema: {
    description:
      "A key type the signer generates: RSA, DSA, an EC curve, or Ed25519",
  },
};

/** A CA's key: still P-256, or RSA 2048 (ADR 0018, ADR 0020). */
export const CA_KEY_ALGORITHM_VALUES = ["P-256", "RSA-2048"] as const;
export type CaKeyAlgorithmName = (typeof CA_KEY_ALGORITHM_VALUES)[number];

export const CA_KEY_ALGORITHM_ENUM = {
  enum: [...CA_KEY_ALGORITHM_VALUES],
  enumName: "CaKeyAlgorithm",
  enumSchema: { description: "A CA's key type: P-256 or RSA 2048" },
};

/** Names by type, as a certificate carries them. */
export class Names {
  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "DNS names",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dns?: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "IP addresses (for a CA's constraints, networks: 10.0.0.0/8)",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ip?: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "Email addresses (for a CA's constraints, domains)",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  email?: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "URIs",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uri?: string[];
}

/** Names by type, as a certificate carries them: also UPNs and OIDs. */
export class CertificateNames extends Names {
  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "Microsoft user principal names (otherName): user@domain",
  })
  @IsOptional()
  @IsArray()
  @Matches(UPN, { each: true })
  upn?: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "registeredIDs: dotted OIDs",
  })
  @IsOptional()
  @IsArray()
  @Matches(OID, { each: true })
  registeredId?: string[];
}

/** How whoever runs a CA is reached: its issuer alternative names. */
export class ContactNames {
  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "Email addresses",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  email?: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    description: "URIs",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uri?: string[];
}

/** A CA's name constraints: what it and everything below it may name. */
export class NameConstraints {
  @ApiProperty({
    type: () => Names,
    required: false,
    description: "Subtrees every name must fall within, by type",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Names)
  permitted?: Names;

  @ApiProperty({
    type: () => Names,
    required: false,
    description: "Subtrees no name may fall within, by type",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Names)
  excluded?: Names;
}

export const isNameType = (value: string): value is NameTypeName =>
  (NAME_TYPE_VALUES as readonly string[]).includes(value);

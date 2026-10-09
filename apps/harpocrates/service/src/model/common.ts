import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

/*
 * Schema pieces shared by the management API's shapes (see
 * docs/conventions/model.md). Enums are string-literal arrays; each is one
 * named schema, described once.
 */

export const NAME_TYPE_VALUES = ["dns", "ip", "email", "uri"] as const;
export type NameTypeName = (typeof NAME_TYPE_VALUES)[number];

export const NAME_TYPE_ENUM = {
  enum: [...NAME_TYPE_VALUES],
  enumName: "NameType",
  enumSchema: { description: "A kind of name: DNS, IP address, email or URI" },
};

export const KEY_ALGORITHM_VALUES = ["P-256", "RSA-2048"] as const;
export type KeyAlgorithmName = (typeof KEY_ALGORITHM_VALUES)[number];

export const KEY_ALGORITHM_ENUM = {
  enum: [...KEY_ALGORITHM_VALUES],
  enumName: "KeyAlgorithm",
  enumSchema: { description: "A key type the signer generates" },
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

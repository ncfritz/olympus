import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from "class-validator";
import type { Moment } from "moment";

export const SSH_CERTIFICATE_TYPE_VALUES = ["user", "host"] as const;
export type SshCertificateTypeName =
  (typeof SSH_CERTIFICATE_TYPE_VALUES)[number];

export const SSH_CERTIFICATE_TYPE_ENUM = {
  enum: [...SSH_CERTIFICATE_TYPE_VALUES],
  enumName: "SshCertificateType",
  enumSchema: {
    description:
      "user: logs its holder in as its principals; host: vouches for a host's names",
  },
};

export const SSH_CA_STATUS_VALUES = ["active", "retired"] as const;
export type SshCaStatusName = (typeof SSH_CA_STATUS_VALUES)[number];

export const SSH_EXTENSION_VALUES = [
  "permit-pty",
  "permit-port-forwarding",
  "permit-agent-forwarding",
  "permit-X11-forwarding",
  "permit-user-rc",
] as const;
export type SshExtensionName = (typeof SSH_EXTENSION_VALUES)[number];

export const SSH_EXTENSION_ENUM = {
  enum: [...SSH_EXTENSION_VALUES],
  enumName: "SshExtension",
  enumSchema: {
    description: "An OpenSSH extension: what a user certificate permits",
  },
};

/** A Unix user name, as a principal. */
export const PRINCIPAL = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,31}$/;

/** The longest an SSH CA may sign, in hours: the signer's 400 days. */
export const SSH_MAX_VALIDITY_HOURS = 400 * 24;

/** An SSH CA's default longest certificate: a week for users, a year for hosts. */
export const SSH_DEFAULT_MAX_VALIDITY_HOURS: Record<
  SshCertificateTypeName,
  number
> = { user: 7 * 24, host: 365 * 24 };

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** An SSH CA (ADR 0035): an online Ed25519 key signing one type. */
export class SshCa {
  @ApiProperty({
    type: String,
    required: true,
    description: "Its slug, e.g. ssh-user-1-g1",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its name, e.g. ncfritz.net SSH User CA 1 - G1",
  })
  name: string;

  @ApiProperty({
    ...SSH_CERTIFICATE_TYPE_ENUM,
    required: true,
    description: "What it signs",
  })
  type: SshCertificateTypeName;

  @ApiProperty({ type: Number, required: true, description: "Its number" })
  number: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its generation: a rotation is the next",
  })
  generation: number;

  @ApiProperty({
    type: String,
    enum: [...SSH_CA_STATUS_VALUES],
    enumName: "SshCaStatus",
    required: true,
    description:
      "active: signs; retired: signs nothing more, trusted until its certificates expire",
  })
  status: SshCaStatusName;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its key, OpenSSH format",
  })
  publicKey: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The line that trusts it: for a user CA, one for the file sshd_config's TrustedUserCAKeys names; for a host CA, one for known_hosts",
  })
  trustLine: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The longest certificate it signs, in hours",
  })
  maxValidityHours: number;

  @ApiProperty({
    type: String,
    required: true,
    description: "Where its KRL is published",
  })
  krlUrl: string;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it was retired",
  })
  retiredAt?: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was created",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/** The principals an Olympus identity may log in as. */
export class SshPrincipalMapping {
  @ApiProperty({
    type: String,
    required: true,
    description: "The identity's email",
  })
  identity: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "Its principals: Unix user names",
  })
  principals: string[];

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was first mapped",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateSshCaRequest {
  @ApiProperty({
    ...SSH_CERTIFICATE_TYPE_ENUM,
    required: true,
    description: "What it signs",
  })
  @IsIn([...SSH_CERTIFICATE_TYPE_VALUES])
  type: SshCertificateTypeName;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "Its number; by default 1. Its generation is the next of that type and number: a rotation",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  number?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description:
      "The longest certificate it signs, in hours; by default a week for users, a year for hosts",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(SSH_MAX_VALIDITY_HOURS)
  maxValidityHours?: number;
}

export class SetSshPrincipalsRequest {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "The identity's principals, replacing those it had; none removes the mapping",
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(32)
  @Matches(PRINCIPAL, { each: true })
  principals: string[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListSshCasResponse {
  @ApiProperty({
    type: () => SshCa,
    isArray: true,
    required: true,
    description: "Every SSH CA, users' first, newest generation first",
  })
  cas: SshCa[];
}

export class DescribeSshCaResponse {
  @ApiProperty({ type: () => SshCa, required: true, description: "The CA" })
  ca: SshCa;
}

export class CreateSshCaResponse {
  @ApiProperty({
    type: () => SshCa,
    required: true,
    description: "The new CA",
  })
  ca: SshCa;
}

export class RetireSshCaResponse {
  @ApiProperty({
    type: () => SshCa,
    required: true,
    description: "The CA, retired",
  })
  ca: SshCa;
}

export class ListSshPrincipalsResponse {
  @ApiProperty({
    type: () => SshPrincipalMapping,
    isArray: true,
    required: true,
    description: "Every mapped identity, by email",
  })
  mappings: SshPrincipalMapping[];
}

export class SetSshPrincipalsResponse {
  @ApiProperty({
    type: () => SshPrincipalMapping,
    required: false,
    description: "The mapping as it now is; none when it was removed",
  })
  mapping?: SshPrincipalMapping;
}

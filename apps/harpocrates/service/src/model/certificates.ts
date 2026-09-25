import { ApiTimestamp, PaginatedResults } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";
import { Names } from "./common";

export const CERTIFICATE_STATE_VALUES = [
  "valid",
  "revoked",
  "expired",
] as const;
export type CertificateStateName = (typeof CERTIFICATE_STATE_VALUES)[number];

export const CERTIFICATE_STATE_ENUM = {
  enum: [...CERTIFICATE_STATE_VALUES],
  enumName: "CertificateState",
  enumSchema: {
    description: "A certificate's state: valid, revoked or expired",
  },
};

export const REVOCATION_REASON_VALUES = [
  "unspecified",
  "keyCompromise",
  "cACompromise",
  "affiliationChanged",
  "superseded",
  "cessationOfOperation",
  "privilegeWithdrawn",
] as const;
export type RevocationReasonName = (typeof REVOCATION_REASON_VALUES)[number];

export const REVOCATION_REASON_ENUM = {
  enum: [...REVOCATION_REASON_VALUES],
  enumName: "RevocationReason",
  enumSchema: { description: "Why a certificate was revoked (RFC 5280)" },
};

export const KEY_LOCATION_VALUES = ["signer", "subscriber", "offline"] as const;
export type KeyLocationName = (typeof KEY_LOCATION_VALUES)[number];

export const DOWNLOAD_FORMAT_VALUES = ["pem", "der", "chain"] as const;
export type DownloadFormatName = (typeof DOWNLOAD_FORMAT_VALUES)[number];

export const EXPORT_FORMAT_VALUES = ["pem", "pkcs12", "pkcs12-legacy"] as const;
export type ExportFormatName = (typeof EXPORT_FORMAT_VALUES)[number];

export const EXPORT_FORMAT_ENUM = {
  enum: [...EXPORT_FORMAT_VALUES],
  enumName: "KeyExportFormat",
  enumSchema: {
    description:
      "How an escrowed key is exported: encrypted PKCS#8, PKCS#12 with the chain, or legacy PKCS#12 (SHA-1, 3DES, no chain)",
  },
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class Revocation {
  @ApiProperty({
    ...REVOCATION_REASON_ENUM,
    required: true,
    description: "Why it was revoked",
  })
  reason: RevocationReasonName;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was revoked",
  })
  revokedAt: Moment;

  @ApiProperty({ type: String, required: true, description: "Who revoked it" })
  principal: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "What they said about it",
  })
  comment?: string;
}

/** A certificate Harpocrates issued (or imported). */
export class Certificate {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The CA that issued it",
  })
  issuerId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The profile it was issued under",
  })
  profileId?: string;

  @ApiProperty({ type: String, required: true, description: "Its serial, hex" })
  serial: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its subject, RFC 4514",
  })
  subject: string;

  @ApiProperty({
    type: () => Names,
    required: true,
    description: "Its alternative names",
  })
  names: Names;

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

  @ApiProperty({
    ...CERTIFICATE_STATE_ENUM,
    required: true,
    description: "Whether it is valid, revoked or expired",
  })
  state: CertificateStateName;

  @ApiProperty({
    type: () => Revocation,
    required: false,
    description: "Its revocation, if it was revoked",
  })
  revocation?: Revocation;

  @ApiProperty({
    enum: [...KEY_LOCATION_VALUES],
    enumName: "KeyLocation",
    required: true,
    description:
      "Where its private key is: escrowed in the signer, or with the subscriber only",
  })
  keyLocation: KeyLocationName;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its key type, e.g. P-256",
  })
  keyAlgorithm: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string: when its key was first certified; renewal rekeys past the profile's maximum key age",
  })
  keyCreatedAt: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "The certificate it renewed",
  })
  renewsId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The certificate that renewed it",
  })
  renewedById?: string;
}

/** A certificate with its PEM and its chain. */
export class FullCertificate extends Certificate {
  @ApiProperty({ type: String, required: true, description: "It, PEM" })
  certificate: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description: "The CAs above it, PEM, nearest first, up to the root",
  })
  chain: string[];
}

export class CertificateSubject {
  @ApiProperty({
    type: String,
    required: true,
    description: "The common name: an app name, a person-device, a host",
  })
  @IsString()
  @IsNotEmpty()
  commonName: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The organizational unit: a service's deployment, a device kind",
  })
  @IsOptional()
  @IsString()
  organizationalUnit?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The organization (the configured one by default)",
  })
  @IsOptional()
  @IsString()
  organization?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateCertificateRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The profile to issue under",
  })
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "An issuer other than the profile's, among those able to sign it",
  })
  @IsOptional()
  @IsString()
  issuerId?: string;

  @ApiProperty({
    type: () => CertificateSubject,
    required: true,
    description: "Its subject",
  })
  @ValidateNested()
  @Type(() => CertificateSubject)
  subject: CertificateSubject;

  @ApiProperty({
    type: () => Names,
    required: false,
    description: "Its alternative names, of the types the profile allows",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Names)
  names?: Names;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The subscriber's CSR, PEM; without one the signer generates (and escrows) the key, if the profile allows",
  })
  @IsOptional()
  @IsString()
  csr?: string;
}

export class ImportCertificatesRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The profile they are taken as issued under: renewing one later follows it",
  })
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "The certificates, PEM; each item may hold several (an XCA export)",
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  certificates: string[];
}

export class RenewCertificateRequest {
  @ApiProperty({
    type: String,
    required: false,
    description:
      "A CSR, PEM: with a new key it rekeys; without one the same key is certified again while it is young enough",
  })
  @IsOptional()
  @IsString()
  csr?: string;
}

export class RevokeCertificateRequest {
  @ApiProperty({
    ...REVOCATION_REASON_ENUM,
    required: true,
    description:
      "Why; keyCompromise also blocks the key for good and revokes every certificate for it",
  })
  @IsIn([...REVOCATION_REASON_VALUES])
  reason: RevocationReasonName;

  @ApiProperty({
    type: String,
    required: false,
    description: "A comment for the audit log",
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ExportCertificateKeyRequest {
  @ApiProperty({
    ...EXPORT_FORMAT_ENUM,
    required: true,
    description: "The file format",
  })
  @IsIn([...EXPORT_FORMAT_VALUES])
  format: ExportFormatName;

  @ApiProperty({
    type: String,
    required: true,
    description: "The passphrase the file is encrypted under",
  })
  @IsString()
  @MinLength(8)
  passphrase: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Why the key is exported, for the audit log",
  })
  @IsString()
  @MinLength(3)
  reason: string;
}

export class ListCertificatesQuery {
  @ApiProperty({
    type: String,
    required: false,
    description: "Only this issuer's",
  })
  @IsOptional()
  @IsString()
  issuerId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Only this profile's",
  })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiProperty({
    ...CERTIFICATE_STATE_ENUM,
    required: false,
    description: "Only in this state",
  })
  @IsOptional()
  @IsIn([...CERTIFICATE_STATE_VALUES])
  state?: CertificateStateName;

  @ApiProperty({
    type: String,
    required: false,
    description: "Subject, name or serial containing this text",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Only valid certificates expiring within this many days",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiringWithinDays?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Page size (50 by default, at most 500)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The page, from 0",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startPage?: number;
}

export class DownloadCertificateQuery {
  @ApiProperty({
    enum: [...DOWNLOAD_FORMAT_VALUES],
    enumName: "CertificateFormat",
    required: false,
    description:
      "pem (the default), der, or chain: it and the CAs above it, PEM, without the root",
  })
  @IsOptional()
  @IsIn([...DOWNLOAD_FORMAT_VALUES])
  format?: DownloadFormatName;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateCertificateResponse {
  @ApiProperty({
    type: () => FullCertificate,
    required: true,
    description: "The new certificate",
  })
  certificate: FullCertificate;
}

export class RenewCertificateResponse {
  @ApiProperty({
    type: () => FullCertificate,
    required: true,
    description: "The renewal",
  })
  certificate: FullCertificate;
}

export class DescribeCertificateResponse {
  @ApiProperty({
    type: () => FullCertificate,
    required: true,
    description: "The certificate",
  })
  certificate: FullCertificate;
}

export class RevokeCertificateResponse {
  @ApiProperty({
    type: () => Certificate,
    isArray: true,
    required: true,
    description:
      "The certificates revoked: this one, and for keyCompromise every other for the key",
  })
  certificates: Certificate[];
}

/** A certificate an import passed over, and why. */
export class SkippedCertificate {
  @ApiProperty({
    type: String,
    required: false,
    description: "Its subject, RFC 4514, if it could be read",
  })
  subject?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Its serial, hex, if it could be read",
  })
  serial?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Why it was not imported",
  })
  reason: string;
}

export class ImportCertificatesResponse {
  @ApiProperty({
    type: () => Certificate,
    isArray: true,
    required: true,
    description: "The certificates imported",
  })
  imported: Certificate[];

  @ApiProperty({
    type: () => SkippedCertificate,
    isArray: true,
    required: true,
    description:
      "Those passed over: already imported, CAs, keys of CAs, or signed by no CA here",
  })
  skipped: SkippedCertificate[];
}

export class ListCertificatesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => Certificate,
    isArray: true,
    required: true,
    description: "The certificates, soonest to expire first",
  })
  certificates: Certificate[];
}

export class ExportCertificateKeyResponse {
  @ApiProperty({
    ...EXPORT_FORMAT_ENUM,
    required: true,
    description: "The file format",
  })
  format: ExportFormatName;

  @ApiProperty({
    type: String,
    required: true,
    description: "A file name for it",
  })
  fileName: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The file, base64",
  })
  data: string;
}

import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import type { Moment } from "moment";
import {
  KEY_ALGORITHM_ENUM,
  KEY_ALGORITHM_VALUES,
  type KeyAlgorithmName,
  NAME_TYPE_ENUM,
  NAME_TYPE_VALUES,
  type NameTypeName,
} from "./common";

export const KEY_USAGE_VALUES = [
  "digital_signature",
  "content_commitment",
  "key_encipherment",
  "data_encipherment",
  "key_agreement",
  "key_cert_sign",
  "crl_sign",
] as const;
export type KeyUsageName = (typeof KEY_USAGE_VALUES)[number];

export const KEY_USAGE_ENUM = {
  enum: [...KEY_USAGE_VALUES],
  enumName: "KeyUsage",
  enumSchema: { description: "A key usage (RFC 5280, 4.2.1.3)" },
};

export const EXTENSION_SET_VALUES = ["standard", "minimal"] as const;
export type ExtensionSetName = (typeof EXTENSION_SET_VALUES)[number];

export const USAGE_STATE_VALUES = [
  "forced",
  "default",
  "optional",
  "excluded",
] as const;
export type UsageStateName = (typeof USAGE_STATE_VALUES)[number];

export const USAGE_STATE_ENUM = {
  enum: [...USAGE_STATE_VALUES],
  enumName: "UsageState",
  enumSchema: {
    description:
      "forced: always; default: unless the request removes it; optional: only if the request (or its CSR) adds it; excluded: never",
  },
};

export const ATTRIBUTE_PRESENCE_VALUES = [
  "required",
  "optional",
  "excluded",
] as const;
export type AttributePresenceName = (typeof ATTRIBUTE_PRESENCE_VALUES)[number];

export const NAME_PRESENCE_VALUES = [
  "required",
  "allowed",
  "excluded",
] as const;
export type NamePresenceName = (typeof NAME_PRESENCE_VALUES)[number];

export const NAME_POLICY_KIND_VALUES = ["permitted", "excluded"] as const;
export type NamePolicyKindName = (typeof NAME_POLICY_KIND_VALUES)[number];

export const HASH_VALUES = [
  "sha1",
  "sha224",
  "sha256",
  "sha384",
  "sha512",
] as const;
export type HashName = (typeof HASH_VALUES)[number];

export const HASH_ENUM = {
  enum: [...HASH_VALUES],
  enumName: "SignatureHash",
  enumSchema: { description: "A signature's hash" },
};

/** A profile's slug: lower case, digits and hyphens. */
export const PROFILE_SLUG = /^[a-z][a-z0-9-]{0,62}$/;

/** A dotted OID. */
const OID = /^[0-2](\.(0|[1-9][0-9]*))+$/;

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A key usage's state in a version. */
export class ProfileKeyUsage {
  @ApiProperty({ ...KEY_USAGE_ENUM, required: true, description: "The usage" })
  @IsIn([...KEY_USAGE_VALUES])
  usage: KeyUsageName;

  @ApiProperty({
    ...USAGE_STATE_ENUM,
    required: true,
    description: "Its state",
  })
  @IsIn([...USAGE_STATE_VALUES])
  state: UsageStateName;
}

/** An extended key usage's state in a version. */
export class ProfileExtendedKeyUsage {
  @ApiProperty({
    type: String,
    required: true,
    description: "The usage, a dotted OID",
  })
  @Matches(OID)
  oid: string;

  @ApiProperty({
    ...USAGE_STATE_ENUM,
    required: true,
    description: "Its state",
  })
  @IsIn([...USAGE_STATE_VALUES])
  state: UsageStateName;
}

/** A version's rule for one subject DN attribute. */
export class ProfileSubjectAttribute {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The attribute: a name (C, ST, L, O, OU, CN, emailAddress, serialNumber, title, givenName, surname, initials, pseudonym, generationQualifier, dnQualifier, description, businessCategory, postalCode, street, UID, DC, jurisdictionCountryName, jurisdictionStateOrProvinceName, jurisdictionLocalityName) or a dotted OID",
  })
  @IsString()
  @IsNotEmpty()
  attribute: string;

  @ApiProperty({
    type: String,
    enum: [...ATTRIBUTE_PRESENCE_VALUES],
    enumName: "AttributePresence",
    required: true,
    description: "Whether a subject must hold it, may, or may not",
  })
  @IsIn([...ATTRIBUTE_PRESENCE_VALUES])
  presence: AttributePresenceName;

  @ApiProperty({
    type: String,
    required: false,
    description: "Its value when the request gives none",
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  defaultValue?: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether the default is the only value it may take",
  })
  @IsBoolean()
  locked: boolean;

  @ApiProperty({
    type: String,
    required: false,
    description: "A regular expression each value must match, whole",
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  pattern?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many values it may take",
  })
  @IsInt()
  @Min(1)
  @Max(16)
  maxCount: number;
}

/** Whether a version allows or requires an alternative name type. */
export class ProfileName {
  @ApiProperty({ ...NAME_TYPE_ENUM, required: true, description: "The type" })
  @IsIn([...NAME_TYPE_VALUES])
  type: NameTypeName;

  @ApiProperty({
    type: String,
    enum: [...NAME_PRESENCE_VALUES],
    enumName: "NamePresence",
    required: true,
    description: "required: at least one; allowed: any number; excluded: none",
  })
  @IsIn([...NAME_PRESENCE_VALUES])
  presence: NamePresenceName;
}

/** A subtree a version's names must lie in, or outside. */
export class ProfileNamePolicy {
  @ApiProperty({ ...NAME_TYPE_ENUM, required: true, description: "The type" })
  @IsIn([...NAME_TYPE_VALUES])
  type: NameTypeName;

  @ApiProperty({
    type: String,
    enum: [...NAME_POLICY_KIND_VALUES],
    enumName: "NamePolicyKind",
    required: true,
    description:
      "permitted: names of the type must lie in one of these (when any is given); excluded: in none",
  })
  @IsIn([...NAME_POLICY_KIND_VALUES])
  kind: NamePolicyKindName;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The subtree, as RFC 5280 reads one: example.com (it and below), .example.com (below only), 10.0.0.0/8, a mail host or mailbox",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  value: string;
}

/**
 * What one version of a profile says a certificate may be (ADR 0020,
 * Profiles; ADR 0034): every setting a version freezes.
 */
export class ProfileSettings {
  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description:
      "The issuer it is pinned to; unset, the active issuing CA of its purpose",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(PROFILE_SLUG)
  issuerId?: string | null;

  @ApiProperty({
    type: String,
    required: true,
    description: "The purpose of the issuing CA it issues from",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  issuerPurpose: string;

  @ApiProperty({
    ...KEY_ALGORITHM_ENUM,
    required: true,
    description:
      "The key type generated for its certificates unless the request chooses another",
  })
  @IsIn([...KEY_ALGORITHM_VALUES])
  keyAlgorithm: KeyAlgorithmName;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How long its certificates are valid, in days",
  })
  @IsInt()
  @Min(1)
  @Max(36500)
  validityDays: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "How many days into a certificate's life it is renewed: less than its validity",
  })
  @IsInt()
  @Min(1)
  renewAtDays: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How old a key may be and still be renewed, in days",
  })
  @IsInt()
  @Min(1)
  maxKeyAgeDays: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether a subscriber may submit a CSR",
  })
  @IsBoolean()
  allowCsr: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether the signer may generate (and escrow) the key, or be brought one",
  })
  @IsBoolean()
  allowGenerated: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether an escrowed key exports as legacy PKCS#12 (SHA-1, 3DES, no chain)",
  })
  @IsBoolean()
  legacyExport: boolean;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many alternative names a certificate needs, at least",
  })
  @IsInt()
  @Min(0)
  @Max(100)
  minNames: number;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether a generated key stays escrowed, exportable again; off, it is exported once and destroyed",
  })
  @IsBoolean()
  escrow: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "Whether one request may choose escrow otherwise",
  })
  @IsBoolean()
  escrowOverridable: boolean;

  @ApiProperty({
    type: String,
    enum: [...EXTENSION_SET_VALUES],
    enumName: "ExtensionSet",
    required: true,
    description:
      "standard: the extensions its rules make; minimal: the key identifiers and nothing else",
  })
  @IsIn([...EXTENSION_SET_VALUES])
  extensions: ExtensionSetName;

  @ApiProperty({
    type: () => ProfileKeyUsage,
    isArray: true,
    required: true,
    description: "Its key usages' states; one not listed is excluded",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileKeyUsage)
  keyUsages: ProfileKeyUsage[];

  @ApiProperty({
    type: () => ProfileExtendedKeyUsage,
    isArray: true,
    required: true,
    description: "Its extended key usages' states; one not listed is excluded",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileExtendedKeyUsage)
  extendedKeyUsages: ProfileExtendedKeyUsage[];

  @ApiProperty({
    type: () => ProfileName,
    isArray: true,
    required: true,
    description:
      "The alternative name types it allows or requires; one not listed is excluded",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileName)
  names: ProfileName[];

  @ApiProperty({
    type: () => ProfileNamePolicy,
    isArray: true,
    required: true,
    description: "Its name policy: subtrees names must lie in or outside",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileNamePolicy)
  namePolicy: ProfileNamePolicy[];

  @ApiProperty({
    type: () => ProfileSubjectAttribute,
    isArray: true,
    required: true,
    description: "Its subject DN rules; an attribute not listed is excluded",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileSubjectAttribute)
  subjectAttributes: ProfileSubjectAttribute[];

  @ApiProperty({
    ...KEY_ALGORITHM_ENUM,
    isArray: true,
    required: true,
    description:
      "The key types a request may choose; none, any the signer generates",
  })
  @IsArray()
  @ArrayUnique()
  @IsIn([...KEY_ALGORITHM_VALUES], { each: true })
  keyAlgorithms: KeyAlgorithmName[];

  @ApiProperty({
    ...HASH_ENUM,
    isArray: true,
    required: true,
    description:
      "The hashes a CSR's signature may use; none, any (an Ed25519 CSR has none and always passes)",
  })
  @IsArray()
  @ArrayUnique()
  @IsIn([...HASH_VALUES], { each: true })
  csrSignatureHashes: HashName[];
}

/** One version of a profile, frozen once made (ADR 0034). */
export class ProfileVersion extends ProfileSettings {
  @ApiProperty({ type: Number, required: true, description: "v1, v2, …" })
  version: number;

  @ApiProperty({
    type: String,
    required: true,
    description: "Who made it: a principal, or `migration` for the seeds",
  })
  createdBy: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was made",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/**
 * What a certificate may be (ADR 0020, Profiles): the profile, read as its
 * latest version, which new certificates take (ADR 0034).
 */
export class Profile extends ProfileSettings {
  @ApiProperty({
    type: String,
    required: true,
    description: "The profile's name, e.g. internal-tls",
  })
  id: string;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The version these settings are: the latest, which new certificates take (ADR 0034)",
  })
  version: number;

  @ApiProperty({
    type: String,
    required: true,
    description: "What it is for",
  })
  description: string;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether it is issued only in a ceremony with a root that signs directly",
  })
  directOnly: boolean;

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "Whether a new certificate may choose it; inactive, what was issued under it still renews",
  })
  active: boolean;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it was deactivated",
  })
  deactivatedAt?: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was made",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/** A new profile: its name, what it is for, and its v1. */
export class BaseProfile extends ProfileSettings {
  @ApiProperty({
    type: String,
    required: true,
    description: "Its name: lower case, digits and hyphens, e.g. web-tls",
  })
  @IsString()
  @Matches(PROFILE_SLUG)
  id: string;

  @ApiProperty({ type: String, required: true, description: "What it is for" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;
}

/**
 * A profile's changes: what is given changes, the rest carries over. A
 * changed setting makes its next version; a description alone does not.
 */
export class PartialProfile extends PartialType(
  OmitType(BaseProfile, ["id"] as const),
) {}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateProfileRequest {
  @ApiProperty({
    type: () => BaseProfile,
    required: true,
    description: "The profile, and its first version's settings",
  })
  @ValidateNested()
  @Type(() => BaseProfile)
  profile: BaseProfile;
}

export class UpdateProfileRequest {
  @ApiProperty({
    type: () => PartialProfile,
    required: true,
    description: "What changes",
  })
  @ValidateNested()
  @Type(() => PartialProfile)
  profile: PartialProfile;
}

export class CopyProfileRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The new profile's name",
  })
  @IsString()
  @Matches(PROFILE_SLUG)
  id: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "What it is for; by default the copied profile's",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description?: string;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The version to copy; by default the latest",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class MoveProfileEnrollmentsRequest {
  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    description:
      "The certificates whose enrollments move: their next renewal uses the version",
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  certificateIds: string[];

  @ApiProperty({
    type: Number,
    required: true,
    description: "The version of this profile they move to",
  })
  @IsInt()
  @Min(1)
  version: number;
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

export class CreateProfileResponse {
  @ApiProperty({
    type: () => Profile,
    required: true,
    description: "The profile, at v1",
  })
  profile: Profile;
}

export class CopyProfileResponse {
  @ApiProperty({
    type: () => Profile,
    required: true,
    description: "The new profile, at v1",
  })
  profile: Profile;
}

export class DeactivateProfileResponse {
  @ApiProperty({
    type: () => Profile,
    required: true,
    description: "The profile, inactive",
  })
  profile: Profile;
}

export class ReactivateProfileResponse {
  @ApiProperty({
    type: () => Profile,
    required: true,
    description: "The profile, active",
  })
  profile: Profile;
}

export class ListProfileVersionsResponse {
  @ApiProperty({
    type: () => ProfileVersion,
    isArray: true,
    required: true,
    description: "Its versions, newest first",
  })
  versions: ProfileVersion[];
}

export class MoveProfileEnrollmentsResponse {
  @ApiProperty({
    type: Number,
    required: true,
    description: "How many enrollments moved",
  })
  moved: number;
}

export class UpdateProfileResponse {
  @ApiProperty({
    type: () => Profile,
    required: true,
    description: "The profile, updated",
  })
  profile: Profile;
}

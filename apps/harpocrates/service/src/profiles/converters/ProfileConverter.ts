import type {
  Profile as ProfileRow,
  ProfileExtendedKeyUsage,
  ProfileKeyUsage,
  ProfileNameType,
  ProfileCsrHash as ProfileCsrHashRow,
  ProfileKeyAlgorithm as ProfileKeyAlgorithmRow,
  ProfileNamePolicy as ProfileNamePolicyRow,
  ProfileSubjectAttribute as ProfileSubjectAttributeRow,
  ProfilePolicy as ProfilePolicyRow,
  ProfileSshExtension as ProfileSshExtensionRow,
  ProfileSshSettings as ProfileSshSettingsRow,
  ProfileSshSourceAddress as ProfileSshSourceAddressRow,
  ProfileCustomExtension as ProfileCustomExtensionRow,
  ProfileVersion as ProfileVersionRow,
  NamePresence,
  UsageState,
} from "../../store/prisma";
import {
  attributeName,
  attributeOid,
  attributeRank,
} from "../subjectAttributes";
import type { KeyAlgorithmName, SubtreeNameTypeName } from "../../model/common";
import moment from "moment";
import type { SshExtensionName } from "../../model/ssh";
import type {
  HashName,
  KeyUsageName,
  Profile,
  ProfileSettings,
  ProfileVersion,
} from "../../model/profiles";

/** A profile version with its rules. */
export type ProfileVersionWithRules = ProfileVersionRow & VersionRules;

/** A version's rules, as the store keeps them. */
type VersionRules = {
  keyUsages: ProfileKeyUsage[];
  extendedKeyUsages: ProfileExtendedKeyUsage[];
  nameTypes: ProfileNameType[];
  subjectAttributes: ProfileSubjectAttributeRow[];
  namePolicies: ProfileNamePolicyRow[];
  keyAlgorithms: ProfileKeyAlgorithmRow[];
  csrHashes: ProfileCsrHashRow[];
  policies: ProfilePolicyRow[];
  customExtensions: ProfileCustomExtensionRow[];
  ssh: ProfileSshSettingsRow | null;
  sshSourceAddresses: ProfileSshSourceAddressRow[];
  sshExtensions: ProfileSshExtensionRow[];
};

/** A version's rules, to include with it. */
export const VERSION_RULES = {
  keyUsages: true,
  extendedKeyUsages: true,
  nameTypes: true,
  subjectAttributes: true,
  namePolicies: true,
  keyAlgorithms: true,
  csrHashes: true,
  policies: true,
  customExtensions: true,
  ssh: true,
  sshSourceAddresses: true,
  sshExtensions: true,
} as const;

/** A profile with a version's rules: its latest, or another's to renew. */
export const PROFILE_WITH_VERSION = {
  profile: true,
  ...VERSION_RULES,
} as const;

/**
 * A profile as one of its versions reads (ADR 0034): the profile's own
 * fields (its slug as `id`, its description and kind, whether it is
 * active), and that version's settings and rules. What issuance works
 * from, whichever version it is.
 */
export type ProfileWithRules = Omit<
  ProfileVersionWithRules,
  "id" | "profileId" | "createdAt" | "updatedAt" | "createdBy"
> & {
  id: string;
  kind: ProfileRow["kind"];
  description: string;
  directOnly: boolean;
  deactivatedAt: Date | null;
  /** The version's own id, as enrollments and certificates record it. */
  versionId: string;
  createdAt: Date;
  updatedAt: Date;
};

/** A profile and one of its versions, as issuance reads them. */
export const asProfileWithRules = (
  version: ProfileVersionWithRules & { profile: ProfileRow },
): ProfileWithRules => {
  const {
    profile,
    id: versionId,
    profileId: _profileId,
    createdAt: _versionCreatedAt,
    updatedAt: _versionUpdatedAt,
    createdBy: _createdBy,
    ...settings
  } = version;
  return {
    ...settings,
    id: profile.id,
    kind: profile.kind,
    description: profile.description,
    directOnly: profile.directOnly,
    deactivatedAt: profile.deactivatedAt,
    versionId,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

const ALGORITHMS: Record<ProfileVersionRow["keyAlgorithm"], KeyAlgorithmName> =
  {
    RSA_2048: "RSA-2048",
    RSA_3072: "RSA-3072",
    RSA_4096: "RSA-4096",
    RSA_8192: "RSA-8192",
    DSA_2048: "DSA-2048",
    DSA_3072: "DSA-3072",
    P_256: "P-256",
    P_384: "P-384",
    P_521: "P-521",
    Ed25519: "Ed25519",
  };

export const keyAlgorithmName = (row: {
  keyAlgorithm: ProfileVersionRow["keyAlgorithm"];
}): KeyAlgorithmName => ALGORITHMS[row.keyAlgorithm];

/** A version's settings, as the API gives them. */
export const toSettings = (
  row: Pick<
    ProfileVersionRow,
    | "issuerId"
    | "issuerPurpose"
    | "keyAlgorithm"
    | "validityDays"
    | "renewAtDays"
    | "maxKeyAgeDays"
    | "allowCsr"
    | "allowGenerated"
    | "legacyExport"
    | "minNames"
    | "escrow"
    | "escrowOverridable"
    | "extensions"
    | "signatureHash"
    | "rsaPadding"
    | "subjectKeyIdentifier"
    | "authorityKeyIdentifier"
    | "basicConstraints"
    | "includeCrlDistribution"
    | "includeCaIssuers"
    | "includeIssuerAltName"
    | "includeOcsp"
    | "mustStaple"
  > &
    VersionRules,
): ProfileSettings => ({
  issuerId: row.issuerId ?? undefined,
  issuerPurpose: row.issuerPurpose,
  keyAlgorithm: keyAlgorithmName(row),
  validityDays: row.validityDays,
  renewAtDays: row.renewAtDays,
  maxKeyAgeDays: row.maxKeyAgeDays,
  allowCsr: row.allowCsr,
  allowGenerated: row.allowGenerated,
  legacyExport: row.legacyExport,
  minNames: row.minNames,
  escrow: row.escrow,
  escrowOverridable: row.escrowOverridable,
  extensions: row.extensions,
  keyUsages: row.keyUsages
    .map((u) => ({ usage: u.usage as KeyUsageName, state: u.state }))
    .sort((a, b) => a.usage.localeCompare(b.usage)),
  extendedKeyUsages: row.extendedKeyUsages
    .map((u) => ({ oid: u.oid, state: u.state }))
    .sort((a, b) => a.oid.localeCompare(b.oid)),
  names: row.nameTypes
    .map((t) => ({ type: t.type, presence: t.presence }))
    .sort((a, b) => a.type.localeCompare(b.type)),
  namePolicy: row.namePolicies
    .map((p) => ({
      type: p.type as SubtreeNameTypeName,
      kind: p.kind,
      value: p.value,
    }))
    .sort((a, b) =>
      `${a.type}${a.kind}${a.value}`.localeCompare(
        `${b.type}${b.kind}${b.value}`,
      ),
    ),
  subjectAttributes: [...row.subjectAttributes]
    .sort((a, b) => attributeRank(a.oid) - attributeRank(b.oid))
    .map((a) => ({
      attribute: attributeName(a.oid),
      presence: a.presence,
      defaultValue: a.defaultValue ?? undefined,
      locked: a.locked,
      pattern: a.pattern ?? undefined,
      maxCount: a.maxCount,
    })),
  keyAlgorithms: row.keyAlgorithms.map((k) => ALGORITHMS[k.algorithm]).sort(),
  csrSignatureHashes: row.csrHashes.map((h) => h.hash as HashName).sort(),
  signatureHash: row.signatureHash,
  rsaPadding: row.rsaPadding,
  subjectKeyIdentifier: row.subjectKeyIdentifier,
  authorityKeyIdentifier: row.authorityKeyIdentifier,
  basicConstraints: row.basicConstraints,
  includeCrlDistribution: row.includeCrlDistribution,
  includeCaIssuers: row.includeCaIssuers,
  includeIssuerAltName: row.includeIssuerAltName,
  includeOcsp: row.includeOcsp,
  mustStaple: row.mustStaple,
  policies: [...row.policies]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      oid: p.oid,
      cpsUri: p.cpsUri ?? undefined,
      userNotice: p.userNotice ?? undefined,
    })),
  customExtensions: [...row.customExtensions]
    .sort((a, b) => a.oid.localeCompare(b.oid))
    .map((e) => ({
      oid: e.oid,
      critical: e.critical,
      value: Buffer.from(e.value).toString("base64"),
    })),
  ...(row.ssh
    ? {
        ssh: {
          certificateType: row.ssh.certificateType,
          sshCaId: row.ssh.sshCaId ?? undefined,
          validityHours: row.ssh.validityHours,
          renewAtHours: row.ssh.renewAtHours,
          forceCommand: row.ssh.forceCommand ?? undefined,
          sourceAddresses: [...row.sshSourceAddresses]
            .sort((a, b) => a.id - b.id)
            .map((a) => a.value),
          extensions: row.sshExtensions
            .map((e) => e.extension as SshExtensionName)
            .sort(),
        },
      }
    : {}),
});

export const toDomainObject = (row: ProfileWithRules): Profile => ({
  id: row.id,
  kind: row.kind,
  version: row.version,
  description: row.description,
  directOnly: row.directOnly,
  active: !row.deactivatedAt,
  deactivatedAt: row.deactivatedAt ? moment(row.deactivatedAt) : undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
  ...toSettings(row),
});

export const toProfileVersion = (
  row: ProfileVersionWithRules,
): ProfileVersion => ({
  version: row.version,
  createdBy: row.createdBy,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
  ...toSettings(row),
});

/** The algorithm names the store keeps, by the API's names. */
export const KEY_ALGORITHM_ROWS = Object.fromEntries(
  Object.entries(ALGORITHMS).map(([row, name]) => [name, row]),
) as Record<KeyAlgorithmName, ProfileVersionRow["keyAlgorithm"]>;

/** Where an unsaved version stands in for a stored one's ids. */
const UNSAVED = "00000000-0000-0000-0000-000000000000";

/**
 * Settings not yet saved, read as a stored version would read them (ADR
 * 0034, preview): stored as `writeVersion` stores them, excluded usages
 * and names unlisted, so a preview is what the saved version issues.
 */
export const unsavedVersion = (
  settings: ProfileSettings,
  profile: {
    id: string;
    kind?: ProfileWithRules["kind"];
    description: string;
    directOnly: boolean;
  },
): ProfileWithRules => {
  const now = new Date();
  const pv = { profileVersionId: UNSAVED };
  return {
    id: profile.id,
    kind: profile.kind ?? "x509",
    description: profile.description,
    directOnly: profile.directOnly,
    deactivatedAt: null,
    versionId: UNSAVED,
    version: 0,
    createdAt: now,
    updatedAt: now,
    issuerId: settings.issuerId ?? null,
    issuerPurpose: settings.issuerPurpose,
    keyAlgorithm: KEY_ALGORITHM_ROWS[settings.keyAlgorithm],
    validityDays: settings.validityDays,
    renewAtDays: settings.renewAtDays,
    maxKeyAgeDays: settings.maxKeyAgeDays,
    allowCsr: settings.allowCsr,
    allowGenerated: settings.allowGenerated,
    legacyExport: settings.legacyExport,
    minNames: settings.minNames,
    escrow: settings.escrow,
    escrowOverridable: settings.escrowOverridable,
    extensions: settings.extensions,
    signatureHash: settings.signatureHash,
    rsaPadding: settings.rsaPadding,
    subjectKeyIdentifier: settings.subjectKeyIdentifier,
    authorityKeyIdentifier: settings.authorityKeyIdentifier,
    basicConstraints: settings.basicConstraints,
    includeCrlDistribution: settings.includeCrlDistribution,
    includeCaIssuers: settings.includeCaIssuers,
    includeIssuerAltName: settings.includeIssuerAltName,
    includeOcsp: settings.includeOcsp ?? false,
    mustStaple: settings.mustStaple ?? false,
    keyUsages: settings.keyUsages
      .filter((u) => u.state !== "excluded")
      .map((u) => ({ ...pv, usage: u.usage, state: u.state as UsageState })),
    extendedKeyUsages: settings.extendedKeyUsages
      .filter((u) => u.state !== "excluded")
      .map((u) => ({ ...pv, oid: u.oid, state: u.state as UsageState })),
    nameTypes: settings.names
      .filter((n) => n.presence !== "excluded")
      .map((n) => ({
        ...pv,
        type: n.type,
        presence: n.presence as NamePresence,
      })),
    namePolicies: settings.namePolicy.map((p, i) => ({
      ...pv,
      id: i,
      type: p.type,
      kind: p.kind,
      value: p.value.trim(),
    })),
    subjectAttributes: settings.subjectAttributes.flatMap((a) => {
      const oid = attributeOid(a.attribute);
      return oid
        ? [
            {
              ...pv,
              oid,
              presence: a.presence,
              defaultValue: a.defaultValue || null,
              locked: a.locked,
              pattern: a.pattern || null,
              maxCount: a.maxCount,
            },
          ]
        : [];
    }),
    keyAlgorithms: settings.keyAlgorithms.map((algorithm) => ({
      ...pv,
      algorithm: KEY_ALGORITHM_ROWS[algorithm],
    })),
    csrHashes: settings.csrSignatureHashes.map((hash) => ({ ...pv, hash })),
    policies: settings.policies.map((p, position) => ({
      ...pv,
      id: position,
      position,
      oid: p.oid,
      cpsUri: p.cpsUri || null,
      userNotice: p.userNotice || null,
    })),
    customExtensions: settings.customExtensions.map((e, i) => ({
      ...pv,
      id: i,
      oid: e.oid,
      critical: e.critical,
      value: new Uint8Array(Buffer.from(e.value, "base64")),
    })),
    ssh: settings.ssh
      ? {
          ...pv,
          certificateType: settings.ssh.certificateType,
          sshCaId: settings.ssh.sshCaId ?? null,
          validityHours: settings.ssh.validityHours,
          renewAtHours: settings.ssh.renewAtHours,
          forceCommand: settings.ssh.forceCommand || null,
        }
      : null,
    sshSourceAddresses: (settings.ssh?.sourceAddresses ?? []).map(
      (value, i) => ({ ...pv, id: i, value }),
    ),
    sshExtensions: (settings.ssh?.extensions ?? []).map((extension) => ({
      ...pv,
      extension,
    })),
  };
};

import type {
  Profile as ProfileRow,
  ProfileExtendedKeyUsage,
  ProfileKeyUsage,
  ProfileNameType,
  ProfileVersion as ProfileVersionRow,
} from "../../store/prisma";
import type { KeyAlgorithmName } from "../../model/common";
import type { Profile } from "../../model/profiles";

/** A profile version with its rules. */
export type ProfileVersionWithRules = ProfileVersionRow & {
  keyUsages: ProfileKeyUsage[];
  extendedKeyUsages: ProfileExtendedKeyUsage[];
  nameTypes: ProfileNameType[];
};

/** A version's rules, to include with it. */
export const VERSION_RULES = {
  keyUsages: true,
  extendedKeyUsages: true,
  nameTypes: true,
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

export const toDomainObject = (row: ProfileWithRules): Profile => ({
  id: row.id,
  version: row.version,
  description: row.description,
  issuerId: row.issuerId ?? undefined,
  issuerPurpose: row.issuerPurpose,
  keyAlgorithm: keyAlgorithmName(row),
  validityDays: row.validityDays,
  renewAtDays: row.renewAtDays,
  maxKeyAgeDays: row.maxKeyAgeDays,
  allowCsr: row.allowCsr,
  allowGenerated: row.allowGenerated,
  legacyExport: row.legacyExport,
  requireSan: row.requireSan,
  escrow: row.escrow,
  escrowOverridable: row.escrowOverridable,
  extensions: row.extensions,
  directOnly: row.directOnly,
  keyUsages: row.keyUsages.map((u) => u.usage).sort(),
  extendedKeyUsages: row.extendedKeyUsages.map((u) => u.oid).sort(),
  nameTypes: row.nameTypes.map((t) => t.type).sort(),
});

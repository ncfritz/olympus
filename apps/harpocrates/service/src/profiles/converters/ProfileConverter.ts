import type {
  Profile as ProfileRow,
  ProfileExtendedKeyUsage,
  ProfileKeyUsage,
  ProfileNameType,
} from "@prisma/client";
import type { KeyAlgorithmName } from "../../model/common";
import type { Profile } from "../../model/profiles";

export type ProfileWithRules = ProfileRow & {
  keyUsages: ProfileKeyUsage[];
  extendedKeyUsages: ProfileExtendedKeyUsage[];
  nameTypes: ProfileNameType[];
};

export const PROFILE_RULES = {
  keyUsages: true,
  extendedKeyUsages: true,
  nameTypes: true,
} as const;

const ALGORITHMS: Record<ProfileRow["keyAlgorithm"], KeyAlgorithmName> = {
  P_256: "P-256",
  RSA_2048: "RSA-2048",
};

export const keyAlgorithmName = (row: ProfileRow): KeyAlgorithmName =>
  ALGORITHMS[row.keyAlgorithm];

export const toDomainObject = (row: ProfileWithRules): Profile => ({
  id: row.id,
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

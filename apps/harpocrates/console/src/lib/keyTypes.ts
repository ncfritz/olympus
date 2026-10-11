import type { KeyAlgorithm } from "./api/types";

/** A kind of key, as the issuance form offers them. */
export type KeyFamily = "RSA" | "DSA" | "EC" | "Ed25519";

/**
 * The key types the signer generates, by family: its sizes (or curves),
 * first the default. Ed25519 has none to choose.
 */
export const KEY_FAMILIES: {
  family: KeyFamily;
  label: string;
  /** What the second choice is called, when there is one. */
  choice?: string;
  algorithms: { value: KeyAlgorithm; label: string }[];
}[] = [
  {
    family: "RSA",
    label: "RSA",
    choice: "Size",
    algorithms: [
      { value: "RSA-2048", label: "2048 bits" },
      { value: "RSA-3072", label: "3072 bits" },
      { value: "RSA-4096", label: "4096 bits" },
      { value: "RSA-8192", label: "8192 bits" },
    ],
  },
  {
    family: "DSA",
    label: "DSA",
    choice: "Size",
    algorithms: [
      { value: "DSA-2048", label: "2048 bits" },
      { value: "DSA-3072", label: "3072 bits" },
    ],
  },
  {
    family: "EC",
    label: "EC",
    choice: "Curve",
    algorithms: [
      { value: "P-256", label: "P-256" },
      { value: "P-384", label: "P-384" },
      { value: "P-521", label: "P-521" },
    ],
  },
  {
    family: "Ed25519",
    label: "Ed25519",
    algorithms: [{ value: "Ed25519", label: "Ed25519" }],
  },
];

/** The family a key type belongs to. */
export const familyOf = (algorithm: KeyAlgorithm): KeyFamily =>
  KEY_FAMILIES.find((family) =>
    family.algorithms.some((a) => a.value === algorithm),
  )!.family;

/**
 * The key type to start a family at: the profile's, when it is of that
 * family, otherwise the family's first.
 */
export const defaultAlgorithm = (
  family: KeyFamily,
  preferred?: KeyAlgorithm,
): KeyAlgorithm =>
  preferred && familyOf(preferred) === family
    ? preferred
    : KEY_FAMILIES.find((f) => f.family === family)!.algorithms[0].value;

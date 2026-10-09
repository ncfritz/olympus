import type { NameConstraints } from "../model/common";
import type { CaOverrides } from "../model/issuers";

/** The settings a create request gave instead of their defaults (ADR 0032). */
export const overridesGiven = (request: CaOverrides): string[] =>
  (
    [
      "organization",
      "subject",
      "validityDays",
      "algorithm",
      "nameConstraints",
    ] as const
  ).filter((setting) => request[setting] !== undefined);

/** Name constraints as the signer takes them. */
export const signerConstraints = (constraints: NameConstraints | undefined) =>
  constraints && {
    permitted: constraints.permitted,
    excluded: constraints.excluded,
  };

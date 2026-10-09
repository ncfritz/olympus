/**
 * Lifetimes per tier and the issuing window (ADR 0020, Longevity): a CA
 * stops issuing when a certificate of the longest validity it issues, plus
 * 30 days, no longer fits in its remaining life.
 */
import type { IssuerShapeName } from "../model/issuers";
import type { IssuerTierName } from "./issuerNames";

const DAY = 24 * 60 * 60 * 1000;

export const MARGIN_DAYS = 30;

export const TIER_VALIDITY_DAYS: Record<IssuerTierName, number> = {
  root: 20 * 365,
  intermediate: 10 * 365,
  issuing: 5 * 365,
};

export const TIER_PATH_LENGTH: Record<IssuerTierName, number> = {
  root: 2,
  intermediate: 1,
  issuing: 0,
};

/** What an offline CA signs is the tier below it; so is its maximum. */
export const OFFLINE_MAX_VALIDITY_DAYS: Record<
  "root" | "intermediate",
  number
> = {
  root: TIER_VALIDITY_DAYS.intermediate,
  intermediate: TIER_VALIDITY_DAYS.issuing,
};

/** A root's path length, from its shape (ADR 0032). */
export const SHAPE_PATH_LENGTH: Record<IssuerShapeName, number> = {
  three_tier: 2,
  two_tier: 1,
  direct: 0,
};

/** The shape a root's path length means: an imported root has none recorded. */
export const shapeOfPathLength = (
  pathLength: number | undefined,
): IssuerShapeName | undefined =>
  pathLength === 2
    ? "three_tier"
    : pathLength === 1
      ? "two_tier"
      : pathLength === 0
        ? "direct"
        : undefined;

/**
 * The longest certificate an offline CA signs: the tier below it, which
 * for a two-tier root is an issuing CA, and for a root that signs directly
 * its leaves (at most ten years).
 */
export const DIRECT_MAX_VALIDITY_DAYS = 3650;

export const offlineMaxValidityDays = (
  tier: "root" | "intermediate",
  shape?: IssuerShapeName,
): number =>
  tier === "intermediate" || shape === undefined || shape === "three_tier"
    ? OFFLINE_MAX_VALIDITY_DAYS[tier]
    : shape === "two_tier"
      ? TIER_VALIDITY_DAYS.issuing
      : DIRECT_MAX_VALIDITY_DAYS;

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY);

export const issuingWindowClosesAt = (
  notAfter: Date,
  maxValidityDays: number,
): Date => addDays(notAfter, -(maxValidityDays + MARGIN_DAYS));

export const isIssuingWindowOpen = (
  notAfter: Date | null | undefined,
  maxValidityDays: number,
  now: Date = new Date(),
): boolean =>
  notAfter !== null &&
  notAfter !== undefined &&
  now < issuingWindowClosesAt(notAfter, maxValidityDays);

/** A child's notAfter: its tier's lifetime, never past its parent's. */
export const childNotAfter = (
  notBefore: Date,
  tier: IssuerTierName,
  parentNotAfter: Date,
): Date => {
  const wanted = addDays(notBefore, TIER_VALIDITY_DAYS[tier]);
  return wanted < parentNotAfter ? wanted : parentNotAfter;
};

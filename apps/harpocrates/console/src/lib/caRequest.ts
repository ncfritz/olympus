import type {
  IssuerShape,
  IssuerTier,
  KeyAlgorithm,
  NameConstraints,
  PreviewIssuerRequest,
} from "./api/types";

/** What the settings form holds: a CA's parts and its overrides. */
export interface CaFormValues {
  organization?: string;
  purpose?: string;
  number?: number;
  generation?: number;
  /** Whether the subject is written outright rather than built. */
  customSubject?: boolean;
  subject?: string;
  validityDays?: number;
  algorithm?: KeyAlgorithm;
  permittedDns?: string[];
  excludedDns?: string[];
  permittedEmail?: string[];
  permittedIp?: string[];
  excludedIp?: string[];
  maxValidityDays?: number;
  extendedKeyUsages?: string[];
}

/** Which CA the form is for. */
export interface CaTarget {
  tier: IssuerTier;
  parentId?: string;
  shape?: IssuerShape;
}

const text = (value: string | undefined) => value?.trim() || undefined;
const list = (value: string[] | undefined) =>
  value && value.length > 0 ? value : undefined;

/**
 * The constraints the form names, or none: an empty object would still
 * count as an override.
 */
const constraintsOf = (values: CaFormValues): NameConstraints | undefined => {
  const permitted = {
    dns: list(values.permittedDns),
    email: list(values.permittedEmail),
    ip: list(values.permittedIp),
  };
  const excluded = {
    dns: list(values.excludedDns),
    ip: list(values.excludedIp),
  };
  const some = (names: Record<string, string[] | undefined>) =>
    Object.values(names).some(Boolean) ? names : undefined;
  const constraints = { permitted: some(permitted), excluded: some(excluded) };
  return constraints.permitted || constraints.excluded
    ? (constraints as NameConstraints)
    : undefined;
};

/** The preview request, and the create request's settings, from the form. */
export const caRequestOf = (
  target: CaTarget,
  values: CaFormValues,
): PreviewIssuerRequest => ({
  tier: target.tier,
  parentId: target.parentId,
  shape: target.shape,
  purpose: text(values.purpose),
  number: values.number ?? 1,
  generation: values.generation ?? 1,
  organization: text(values.organization),
  subject: values.customSubject ? text(values.subject) : undefined,
  validityDays: values.validityDays ?? undefined,
  algorithm: values.algorithm,
  nameConstraints: constraintsOf(values),
  maxValidityDays: values.maxValidityDays ?? undefined,
  extendedKeyUsages: list(values.extendedKeyUsages),
});

/**
 * A create request's body from a reviewed preview request: the CA's
 * parts and only the settings the operator changed, so the audit log
 * records exactly those as overrides (ADR 0032).
 */
export const createBodyOf = (request: PreviewIssuerRequest) => {
  const { tier: _tier, parentId: _parentId, ...body } = request;
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  ) as Omit<PreviewIssuerRequest, "tier" | "parentId">;
};

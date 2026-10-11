import type {
  KeyAlgorithm,
  NameType,
  ProfileSettings,
  ProfileVersion,
} from "./api/types";
import { describeDays, ekuName } from "./labels";

/**
 * A profile version's settings as the console explains them (ADR 0034):
 * each with a label and help, in the sections the editor and the settings
 * view share; how each reads as text, for the view and a diff; and the
 * editor's form shape.
 */

export type SettingKey = keyof ProfileSettings;

export type UsageState = ProfileSettings["keyUsages"][number]["state"];
export type KeyUsage = ProfileSettings["keyUsages"][number]["usage"];

/** The four usage states, as the editor offers them. */
export const USAGE_STATES: { value: UsageState; label: string }[] = [
  { value: "forced", label: "Forced" },
  { value: "default", label: "Default" },
  { value: "optional", label: "Optional" },
  { value: "excluded", label: "Excluded" },
];

export const USAGE_STATE_HELP =
  "Forced: always in the certificate. Default: in it unless the request removes it. Optional: out of it unless the request (or its CSR) adds it. Excluded: never.";

/** The key usages, as RFC 5280 names them. */
export const KEY_USAGES: { value: KeyUsage; label: string; help: string }[] = [
  {
    value: "digital_signature",
    label: "digitalSignature",
    help: "Signing other than certificates and lists: TLS handshakes, code, documents.",
  },
  {
    value: "content_commitment",
    label: "contentCommitment",
    help: "Non-repudiation: the signer cannot deny a signed document.",
  },
  {
    value: "key_encipherment",
    label: "keyEncipherment",
    help: "Encrypting keys, as RSA key transport does. Only an RSA key can.",
  },
  {
    value: "data_encipherment",
    label: "dataEncipherment",
    help: "Encrypting data directly with the key: rarely used.",
  },
  {
    value: "key_agreement",
    label: "keyAgreement",
    help: "Agreeing a key, as ECDH does.",
  },
  {
    value: "key_cert_sign",
    label: "keyCertSign",
    help: "Signing certificates: a CA's. A leaf should exclude it.",
  },
  {
    value: "crl_sign",
    label: "cRLSign",
    help: "Signing revocation lists: a CA's. A leaf should exclude it.",
  },
];

export const keyUsageName = (usage: string): string =>
  KEY_USAGES.find((u) => u.value === usage)?.label ?? usage;

/** The extended key usages the editor offers by name; any OID is allowed. */
export const KNOWN_EKUS: { value: string; label: string }[] = [
  { value: "1.3.6.1.5.5.7.3.1", label: "serverAuth (TLS server)" },
  { value: "1.3.6.1.5.5.7.3.2", label: "clientAuth (TLS client)" },
  { value: "1.3.6.1.5.5.7.3.3", label: "codeSigning" },
  { value: "1.3.6.1.5.5.7.3.4", label: "emailProtection (S/MIME)" },
  { value: "1.3.6.1.5.5.7.3.8", label: "timeStamping" },
  { value: "1.3.6.1.5.5.7.3.9", label: "OCSPSigning" },
  { value: "1.3.6.1.5.5.7.3.36", label: "documentSigning" },
  { value: "1.3.6.1.4.1.311.20.2.2", label: "smartcardLogon (Microsoft)" },
];

export const NAME_TYPES: { value: NameType; label: string; help: string }[] = [
  { value: "dns", label: "DNS names", help: "Host names: host.example.com." },
  { value: "ip", label: "IP addresses", help: "IPv4 or IPv6 addresses." },
  { value: "email", label: "Email addresses", help: "rfc822Name: a mailbox." },
  {
    value: "uri",
    label: "URIs",
    help: "uniformResourceIdentifier: spiffe://, https://, …",
  },
  {
    value: "upn",
    label: "User principal names",
    help: "Microsoft's otherName for a Windows sign-in: user@domain.",
  },
  {
    value: "registeredId",
    label: "Registered IDs",
    help: "An OID naming the subject.",
  },
];

export const nameTypeLabel = (type: string): string =>
  NAME_TYPES.find((t) => t.value === type)?.label ?? type;

/** The name types with subtrees, for the name policy. */
export const SUBTREE_TYPES = ["dns", "ip", "email", "uri"] as const;

/** The subject attributes a version can rule on: the service's catalogue. */
export const SUBJECT_ATTRIBUTES: {
  value: string;
  label: string;
  standard: boolean;
}[] = [
  { value: "C", label: "Country (two letters)", standard: true },
  { value: "ST", label: "State or province", standard: true },
  { value: "L", label: "Locality", standard: true },
  { value: "O", label: "Organization", standard: true },
  { value: "OU", label: "Organizational unit", standard: true },
  { value: "CN", label: "Common name", standard: true },
  { value: "emailAddress", label: "Email address", standard: true },
  { value: "DC", label: "Domain component", standard: false },
  { value: "street", label: "Street address", standard: false },
  { value: "postalCode", label: "Postal code", standard: false },
  { value: "businessCategory", label: "Business category", standard: false },
  { value: "title", label: "Title", standard: false },
  { value: "description", label: "Description", standard: false },
  {
    value: "serialNumber",
    label: "Serial number (of the subject)",
    standard: false,
  },
  { value: "dnQualifier", label: "DN qualifier", standard: false },
  { value: "givenName", label: "Given name", standard: false },
  { value: "surname", label: "Surname", standard: false },
  { value: "initials", label: "Initials", standard: false },
  {
    value: "generationQualifier",
    label: "Generation qualifier",
    standard: false,
  },
  { value: "pseudonym", label: "Pseudonym", standard: false },
  { value: "UID", label: "User ID", standard: false },
  {
    value: "jurisdictionCountryName",
    label: "Jurisdiction country (EV)",
    standard: false,
  },
  {
    value: "jurisdictionStateOrProvinceName",
    label: "Jurisdiction state or province (EV)",
    standard: false,
  },
  {
    value: "jurisdictionLocalityName",
    label: "Jurisdiction locality (EV)",
    standard: false,
  },
];

export const attributeLabel = (attribute: string): string =>
  SUBJECT_ATTRIBUTES.find((a) => a.value === attribute)?.label ?? attribute;

export const KEY_ALGORITHMS: KeyAlgorithm[] = [
  "P-256",
  "P-384",
  "P-521",
  "Ed25519",
  "RSA-2048",
  "RSA-3072",
  "RSA-4096",
  "RSA-8192",
  "DSA-2048",
  "DSA-3072",
];

export const CSR_HASHES: ProfileSettings["csrSignatureHashes"] = [
  "sha1",
  "sha224",
  "sha256",
  "sha384",
  "sha512",
];

const CHOICES = {
  signatureHash: { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" },
  rsaPadding: { pkcs1v15: "PKCS#1 v1.5", pss: "PSS" },
  subjectKeyIdentifier: {
    sha1: "SHA-1 (RFC 5280)",
    sha256: "Truncated SHA-256 (RFC 7093)",
    none: "None",
  },
  authorityKeyIdentifier: {
    key_id: "The CA's key identifier",
    key_id_and_issuer: "Key identifier, issuer and serial",
    none: "None",
  },
  basicConstraints: {
    critical: "Critical",
    non_critical: "Not critical",
    omitted: "Left out",
  },
  extensions: {
    standard: "Standard",
    minimal: "Key identifiers only",
  },
} as const;

/** A choice setting's options, labelled, for a select. */
export const choicesOf = <K extends keyof typeof CHOICES>(key: K) =>
  Object.entries(CHOICES[key]).map(([value, label]) => ({ value, label }));

type Meta = { label: string; help: string };

/** Every setting's label and help: the editor's tooltips, the view's labels. */
export const SETTINGS: Record<SettingKey, Meta> = {
  issuerPurpose: {
    label: "Issuing CA purpose",
    help: "The purpose of the issuing CA its certificates come from: TLS, Service, … The active issuing CA of this purpose signs them unless one is pinned.",
  },
  issuerId: {
    label: "Pinned issuer",
    help: "An issuing CA to use instead of the active one of its purpose; its successor takes over when its issuing window closes.",
  },
  validityDays: {
    label: "Validity",
    help: "How long its certificates are valid, in days. Never longer than its issuing CA's maximum.",
  },
  renewAtDays: {
    label: "Renewed at",
    help: "How many days into a certificate's life it is due for renewal: less than its validity.",
  },
  maxKeyAgeDays: {
    label: "Maximum key age",
    help: "How old a key may be and still be renewed, in days; past it, a renewal needs a new key.",
  },
  keyAlgorithm: {
    label: "Default key type",
    help: "The key generated for a certificate unless the request chooses another.",
  },
  keyAlgorithms: {
    label: "Key types allowed",
    help: "The key types a request may choose, generated, imported or in a CSR. None listed: any the signer generates.",
  },
  allowCsr: {
    label: "Subscriber CSRs",
    help: "Whether a subscriber may bring its own key, in a CSR.",
  },
  allowGenerated: {
    label: "Generated keys",
    help: "Whether the signer may generate the key, or be brought one to import.",
  },
  csrSignatureHashes: {
    label: "CSR signature hashes",
    help: "The hashes a CSR may be signed with, so SHA-1 CSRs can be refused. None listed: any. An Ed25519 CSR has none and always passes.",
  },
  escrow: {
    label: "Key escrow",
    help: "On: a generated key stays in the signer, exportable again. Off: it is exported once, then destroyed.",
  },
  escrowOverridable: {
    label: "Escrow per certificate",
    help: "Whether a request may choose escrow otherwise.",
  },
  legacyExport: {
    label: "Legacy export",
    help: "An escrowed key exports as legacy PKCS#12 (SHA-1, 3DES, no chain), for devices that read nothing newer.",
  },
  subjectAttributes: {
    label: "Subject",
    help: "Each DN attribute required, optional or excluded; an attribute not listed is excluded. A default fills it when the request gives none; locked, the default is the only value. A pattern must match each value, whole.",
  },
  names: {
    label: "Name types",
    help: "Each alternative name type required (at least one), allowed or excluded.",
  },
  minNames: {
    label: "Minimum names",
    help: "How many alternative names a certificate needs, at least, of any allowed type.",
  },
  namePolicy: {
    label: "Name policy",
    help: "Subtrees names must lie in (permitted, when any is given for the type) or outside (excluded), as RFC 5280 reads them: example.com is it and below, .example.com only below; IP networks as 10.0.0.0/8. The issuing CA's own name constraints apply too.",
  },
  keyUsages: { label: "Key usages", help: USAGE_STATE_HELP },
  extendedKeyUsages: {
    label: "Extended key usages",
    help: `${USAGE_STATE_HELP} The issuing CA must be allowed to sign each one.`,
  },
  signatureHash: {
    label: "Signature hash",
    help: "The hash the CA signs its certificates with. An Ed25519 CA has none to choose.",
  },
  rsaPadding: {
    label: "RSA padding",
    help: "Under an RSA CA, PKCS#1 v1.5 (the usual) or PSS; another CA ignores it.",
  },
  subjectKeyIdentifier: {
    label: "Subject key identifier",
    help: "How the certificate's key is identified: RFC 5280's SHA-1 of the key, RFC 7093's truncated SHA-256, or not at all.",
  },
  authorityKeyIdentifier: {
    label: "Authority key identifier",
    help: "How the issuing CA is identified: its key identifier, that with its own issuer and serial, or not at all (RFC 5280 asks for it).",
  },
  basicConstraints: {
    label: "Basic constraints",
    help: "CA:FALSE, critical, not critical, or left out: some old clients want it absent.",
  },
  extensions: {
    label: "Extensions",
    help: "Standard: what these settings make. Key identifiers only: nothing else, for a consumer that accepts nothing else.",
  },
  includeCrlDistribution: {
    label: "CRL distribution point",
    help: "Whether certificates name the issuing CA's revocation list.",
  },
  includeCaIssuers: {
    label: "CA issuers (AIA)",
    help: "Whether certificates say where the issuing CA's certificate is published.",
  },
  includeIssuerAltName: {
    label: "Issuer alternative name",
    help: "Whether certificates carry the issuing CA's own alternative names (set on the CA's page), where it has any.",
  },
  policies: {
    label: "Certificate policies",
    help: "Policy OIDs its certificates assert, in order, each with an optional CPS URI and a notice for relying parties.",
  },
  customExtensions: {
    label: "Custom extensions",
    help: "Any extension Harpocrates does not build itself, by OID, its value one DER element in base64. Critical: a client that does not know it must reject the certificate.",
  },
};

/** The editor's and the view's sections, in order. */
export const SECTIONS: {
  key: string;
  title: string;
  settings: SettingKey[];
}[] = [
  {
    key: "issuance",
    title: "Issuance",
    settings: [
      "issuerPurpose",
      "issuerId",
      "validityDays",
      "renewAtDays",
      "maxKeyAgeDays",
    ],
  },
  {
    key: "keys",
    title: "Keys and enrollment",
    settings: [
      "keyAlgorithm",
      "keyAlgorithms",
      "allowCsr",
      "allowGenerated",
      "csrSignatureHashes",
      "escrow",
      "escrowOverridable",
      "legacyExport",
    ],
  },
  { key: "subject", title: "Subject", settings: ["subjectAttributes"] },
  {
    key: "names",
    title: "Alternative names",
    settings: ["names", "minNames", "namePolicy"],
  },
  {
    key: "usages",
    title: "Usages",
    settings: ["keyUsages", "extendedKeyUsages"],
  },
  {
    key: "signature",
    title: "Signature and identifiers",
    settings: [
      "signatureHash",
      "rsaPadding",
      "subjectKeyIdentifier",
      "authorityKeyIdentifier",
      "basicConstraints",
    ],
  },
  {
    key: "extensions",
    title: "Extensions",
    settings: [
      "extensions",
      "includeCrlDistribution",
      "includeCaIssuers",
      "includeIssuerAltName",
      "policies",
      "customExtensions",
    ],
  },
];

const onOff = (value: boolean) => (value ? "On" : "Off");
const list = (values: string[]) => (values.length ? values.join(", ") : "None");

/** Each list setting's entries as lines, for the view and a diff. */
export const settingLines = (
  key: SettingKey,
  settings: ProfileSettings,
): string[] => {
  switch (key) {
    case "keyUsages":
      return settings.keyUsages.map(
        (u) => `${keyUsageName(u.usage)}: ${u.state}`,
      );
    case "extendedKeyUsages":
      return settings.extendedKeyUsages.map(
        (u) => `${ekuName(u.oid)}: ${u.state}`,
      );
    case "names":
      return settings.names.map(
        (n) => `${nameTypeLabel(n.type)}: ${n.presence}`,
      );
    case "namePolicy":
      return settings.namePolicy.map((p) => `${p.type} ${p.kind}: ${p.value}`);
    case "subjectAttributes":
      return settings.subjectAttributes.map((a) =>
        [
          `${a.attribute}: ${a.presence}`,
          a.defaultValue &&
            `${a.locked ? "fixed at" : "default"} "${a.defaultValue}"`,
          a.pattern && `matching ${a.pattern}`,
          a.maxCount > 1 && `up to ${a.maxCount}`,
        ]
          .filter(Boolean)
          .join(", "),
      );
    case "policies":
      return settings.policies.map((p) =>
        [
          p.oid,
          p.cpsUri && `CPS ${p.cpsUri}`,
          p.userNotice && `"${p.userNotice}"`,
        ]
          .filter(Boolean)
          .join(", "),
      );
    case "customExtensions":
      return settings.customExtensions.map(
        (e) => `${e.oid}${e.critical ? " (critical)" : ""}: ${e.value}`,
      );
    default:
      return [settingText(key, settings)];
  }
};

/** A setting as one line of text. */
export const settingText = (
  key: SettingKey,
  settings: ProfileSettings,
): string => {
  const value = settings[key];
  switch (key) {
    case "validityDays":
    case "renewAtDays":
    case "maxKeyAgeDays":
      return describeDays(value as number);
    case "issuerId":
      return (value as string | null | undefined) || "The active one";
    case "keyAlgorithms":
      return list(value as string[]).replace(/^None$/, "Any");
    case "csrSignatureHashes":
      return list((value as string[]).map((h) => h.toUpperCase())).replace(
        /^None$/,
        "Any",
      );
    case "signatureHash":
    case "rsaPadding":
    case "subjectKeyIdentifier":
    case "authorityKeyIdentifier":
    case "basicConstraints":
    case "extensions":
      return (CHOICES[key] as Record<string, string>)[value as string];
    case "minNames":
      return String(value);
    default:
      if (typeof value === "boolean") return onOff(value);
      if (Array.isArray(value)) {
        const lines = settingLines(key, settings);
        return lines.length ? lines.join("; ") : "None";
      }
      return String(value ?? "—");
  }
};

/** A value as compared: lists as sets (policies in order), no empty fields. */
const canonical = (key: SettingKey, value: unknown): string => {
  const plain = (v: unknown): unknown =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([, x]) => x !== undefined && x !== null && x !== "")
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : (v ?? null);
  if (!Array.isArray(value)) return JSON.stringify(plain(value));
  const items = value.map((v) => JSON.stringify(plain(v)));
  return JSON.stringify(key === "policies" ? items : items.sort());
};

export type SettingChange = {
  key: SettingKey;
  label: string;
  before: string[];
  after: string[];
};

/** What differs between two versions, setting by setting, in section order. */
export const changedSettings = (
  before: ProfileSettings,
  after: ProfileSettings,
): SettingChange[] =>
  SECTIONS.flatMap((section) => section.settings).flatMap((key) =>
    canonical(key, before[key]) === canonical(key, after[key])
      ? []
      : [
          {
            key,
            label: SETTINGS[key].label,
            before: settingLines(key, before),
            after: settingLines(key, after),
          },
        ],
  );

/** A version's settings alone, from a profile or a version. */
export const settingsOf = (
  source: ProfileSettings & Partial<ProfileVersion>,
): ProfileSettings => {
  const settings = {} as Record<SettingKey, unknown>;
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    settings[key] = source[key];
  }
  return settings as ProfileSettings;
};

/** A new profile's settings: a TLS server certificate, as most are. */
export const NEW_PROFILE_SETTINGS: ProfileSettings = {
  issuerPurpose: "TLS",
  issuerId: null,
  keyAlgorithm: "P-256",
  validityDays: 90,
  renewAtDays: 60,
  maxKeyAgeDays: 365,
  allowCsr: true,
  allowGenerated: true,
  legacyExport: false,
  minNames: 1,
  escrow: true,
  escrowOverridable: false,
  extensions: "standard",
  keyUsages: [
    { usage: "digital_signature", state: "forced" },
    { usage: "key_encipherment", state: "optional" },
  ],
  extendedKeyUsages: [{ oid: "1.3.6.1.5.5.7.3.1", state: "forced" }],
  names: [
    { type: "dns", presence: "required" },
    { type: "ip", presence: "allowed" },
  ],
  namePolicy: [],
  subjectAttributes: [
    { attribute: "CN", presence: "required", locked: false, maxCount: 1 },
    { attribute: "OU", presence: "optional", locked: false, maxCount: 1 },
    { attribute: "O", presence: "optional", locked: false, maxCount: 1 },
  ],
  keyAlgorithms: [],
  csrSignatureHashes: ["sha256", "sha384", "sha512"],
  signatureHash: "sha256",
  rsaPadding: "pkcs1v15",
  subjectKeyIdentifier: "sha1",
  authorityKeyIdentifier: "key_id",
  basicConstraints: "critical",
  includeCrlDistribution: true,
  includeCaIssuers: true,
  includeIssuerAltName: false,
  policies: [],
  customExtensions: [],
};

/**
 * The editor's form: the settings, with the key usages and name types as
 * one state per usage or type (so each has a row), the rest as they are.
 */
export type ProfileForm = Omit<ProfileSettings, "keyUsages" | "names"> & {
  id?: string;
  description?: string;
  keyUsageStates: Record<string, UsageState>;
  namePresences: Record<string, "required" | "allowed" | "excluded">;
};

export const toForm = (
  settings: ProfileSettings,
  profile?: { id?: string; description?: string },
): ProfileForm => {
  const { keyUsages, names, ...rest } = settings;
  return {
    ...rest,
    id: profile?.id,
    description: profile?.description,
    keyUsageStates: Object.fromEntries(
      KEY_USAGES.map((u) => [
        u.value,
        keyUsages.find((k) => k.usage === u.value)?.state ?? "excluded",
      ]),
    ),
    namePresences: Object.fromEntries(
      NAME_TYPES.map((t) => [
        t.value,
        names.find((n) => n.type === t.value)?.presence ?? "excluded",
      ]),
    ),
  };
};

/** Blank text as absent, so the service sees what was not given. */
const optional = (value: string | null | undefined) =>
  value?.trim() ? value.trim() : undefined;

export const fromForm = (form: ProfileForm): ProfileSettings => {
  const settings = settingsOf({
    ...NEW_PROFILE_SETTINGS,
    ...form,
  } as ProfileSettings);
  return {
    ...settings,
    issuerId: optional(form.issuerId) ?? null,
    keyUsages: KEY_USAGES.flatMap((u) => {
      const state = form.keyUsageStates?.[u.value] ?? "excluded";
      return state === "excluded" ? [] : [{ usage: u.value, state }];
    }),
    names: NAME_TYPES.flatMap((t) => {
      const presence = form.namePresences?.[t.value] ?? "excluded";
      return presence === "excluded" ? [] : [{ type: t.value, presence }];
    }),
    extendedKeyUsages: (form.extendedKeyUsages ?? []).filter(
      (u) => u?.oid && u.state !== "excluded",
    ),
    namePolicy: (form.namePolicy ?? []).filter((p) => p?.value?.trim()),
    subjectAttributes: (form.subjectAttributes ?? [])
      .filter((a) => a?.attribute)
      .map((a) => ({
        ...a,
        defaultValue: optional(a.defaultValue),
        pattern: optional(a.pattern),
        locked: a.locked ?? false,
        maxCount: a.maxCount ?? 1,
      })),
    policies: (form.policies ?? [])
      .filter((p) => p?.oid)
      .map((p) => ({
        oid: p.oid.trim(),
        cpsUri: optional(p.cpsUri),
        userNotice: optional(p.userNotice),
      })),
    customExtensions: (form.customExtensions ?? [])
      .filter((e) => e?.oid)
      .map((e) => ({
        oid: e.oid.trim(),
        critical: e.critical ?? false,
        value: e.value?.trim() ?? "",
      })),
  };
};

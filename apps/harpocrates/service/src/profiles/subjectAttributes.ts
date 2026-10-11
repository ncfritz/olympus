/**
 * The subject DN attributes a profile can rule on (ADR 0034): the
 * standard set, and the free-form set as XCA offers it. Any other is ruled
 * on by its dotted OID.
 */
export type SubjectAttributeInfo = {
  /** The name requests and profiles use. */
  name: string;
  oid: string;
  /** What it is, for the console's help. */
  label: string;
  /** Its RFC 4514 short name, where the signer reads one; else its OID. */
  rfc4514?: string;
  standard: boolean;
};

/** In the order a DN holds them, most general first (DER order). */
export const SUBJECT_ATTRIBUTES: SubjectAttributeInfo[] = [
  {
    name: "DC",
    oid: "0.9.2342.19200300.100.1.25",
    label: "Domain component",
    rfc4514: "DC",
    standard: false,
  },
  {
    name: "C",
    oid: "2.5.4.6",
    label: "Country (two letters)",
    rfc4514: "C",
    standard: true,
  },
  {
    name: "jurisdictionCountryName",
    oid: "1.3.6.1.4.1.311.60.2.1.3",
    label: "Jurisdiction country (EV)",
    standard: false,
  },
  {
    name: "jurisdictionStateOrProvinceName",
    oid: "1.3.6.1.4.1.311.60.2.1.2",
    label: "Jurisdiction state or province (EV)",
    standard: false,
  },
  {
    name: "jurisdictionLocalityName",
    oid: "1.3.6.1.4.1.311.60.2.1.1",
    label: "Jurisdiction locality (EV)",
    standard: false,
  },
  {
    name: "ST",
    oid: "2.5.4.8",
    label: "State or province",
    rfc4514: "ST",
    standard: true,
  },
  {
    name: "L",
    oid: "2.5.4.7",
    label: "Locality",
    rfc4514: "L",
    standard: true,
  },
  {
    name: "street",
    oid: "2.5.4.9",
    label: "Street address",
    rfc4514: "STREET",
    standard: false,
  },
  {
    name: "postalCode",
    oid: "2.5.4.17",
    label: "Postal code",
    standard: false,
  },
  {
    name: "O",
    oid: "2.5.4.10",
    label: "Organization",
    rfc4514: "O",
    standard: true,
  },
  {
    name: "OU",
    oid: "2.5.4.11",
    label: "Organizational unit",
    rfc4514: "OU",
    standard: true,
  },
  {
    name: "businessCategory",
    oid: "2.5.4.15",
    label: "Business category",
    standard: false,
  },
  { name: "title", oid: "2.5.4.12", label: "Title", standard: false },
  {
    name: "description",
    oid: "2.5.4.13",
    label: "Description",
    standard: false,
  },
  {
    name: "serialNumber",
    oid: "2.5.4.5",
    label: "Serial number (of the subject, not the certificate)",
    standard: false,
  },
  {
    name: "dnQualifier",
    oid: "2.5.4.46",
    label: "DN qualifier",
    standard: false,
  },
  { name: "givenName", oid: "2.5.4.42", label: "Given name", standard: false },
  { name: "surname", oid: "2.5.4.4", label: "Surname", standard: false },
  { name: "initials", oid: "2.5.4.43", label: "Initials", standard: false },
  {
    name: "generationQualifier",
    oid: "2.5.4.44",
    label: "Generation qualifier (Jr., III)",
    standard: false,
  },
  { name: "pseudonym", oid: "2.5.4.65", label: "Pseudonym", standard: false },
  {
    name: "UID",
    oid: "0.9.2342.19200300.100.1.1",
    label: "User ID",
    rfc4514: "UID",
    standard: false,
  },
  {
    name: "CN",
    oid: "2.5.4.3",
    label: "Common name",
    rfc4514: "CN",
    standard: true,
  },
  {
    name: "emailAddress",
    oid: "1.2.840.113549.1.9.1",
    label: "Email address (in the DN; prefer an email SAN)",
    standard: true,
  },
];

const DOTTED = /^[0-2](\.(0|[1-9][0-9]*))+$/;

const BY_NAME = new Map(
  SUBJECT_ATTRIBUTES.map((a) => [a.name.toLowerCase(), a]),
);
const BY_OID = new Map(SUBJECT_ATTRIBUTES.map((a) => [a.oid, a]));

/** An attribute's OID from its name (any case) or OID; undefined if neither. */
export const attributeOid = (type: string): string | undefined =>
  BY_NAME.get(type.toLowerCase())?.oid ??
  (DOTTED.test(type) ? type : undefined);

/** An attribute's name for the API: its known name, or its OID. */
export const attributeName = (oid: string): string =>
  BY_OID.get(oid)?.name ?? oid;

/** Where an attribute sorts in a DN: known ones in order, others before CN. */
export const attributeRank = (oid: string): number => {
  const index = SUBJECT_ATTRIBUTES.findIndex((a) => a.oid === oid);
  if (index >= 0) return index;
  return SUBJECT_ATTRIBUTES.findIndex((a) => a.name === "CN") - 0.5;
};

/** An attribute's type as RFC 4514 writes it for the signer. */
export const rfc4514Type = (oid: string): string =>
  BY_OID.get(oid)?.rfc4514 ?? oid;

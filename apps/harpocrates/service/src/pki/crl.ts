/**
 * Reading revocation lists: what the service signs through the signer,
 * imports, and fetches back from the distribution URL to check.
 */
import * as x509 from "@peculiar/x509";
import { bytes, rfc4514 } from "./x509";

/** RFC 5280 reason codes, by the names the API and the signer use. */
const REASONS: Record<number, CrlReasonName> = {
  0: "unspecified",
  1: "keyCompromise",
  2: "cACompromise",
  3: "affiliationChanged",
  4: "superseded",
  5: "cessationOfOperation",
  9: "privilegeWithdrawn",
};

export type CrlReasonName =
  | "unspecified"
  | "keyCompromise"
  | "cACompromise"
  | "affiliationChanged"
  | "superseded"
  | "cessationOfOperation"
  | "privilegeWithdrawn";

export type CrlEntry = {
  /** Hex, lower case, no leading zeros: as certificates' serials are kept. */
  serial: string;
  revokedAt: Date;
  reason: CrlReasonName;
};

export type ParsedCrl = {
  der: Uint8Array<ArrayBuffer>;
  /** RFC 4514, as issuers' subjects are kept. */
  issuer: string;
  /** The CRL number extension; undefined if it has none. */
  number?: bigint;
  thisUpdate: Date;
  nextUpdate?: Date;
  entries: CrlEntry[];
};

const CRL_NUMBER = "2.5.29.20";

export const normaliseSerial = (hex: string): string =>
  hex.toLowerCase().replace(/^0+/, "") || "0";

/** A DER INTEGER's value, unsigned. */
const derInteger = (value: ArrayBuffer): bigint => {
  const der = new Uint8Array(value);
  if (der[0] !== 0x02) throw new Error("The CRL number is not an INTEGER");
  let length = der[1];
  let offset = 2;
  if (length & 0x80) {
    const octets = length & 0x7f;
    length = 0;
    for (let i = 0; i < octets; i += 1) length = (length << 8) | der[2 + i];
    offset = 2 + octets;
  }
  const hex = Buffer.from(der.subarray(offset, offset + length)).toString(
    "hex",
  );
  return hex ? BigInt(`0x${hex}`) : 0n;
};

const load = (input: string | Uint8Array): x509.X509Crl =>
  typeof input === "string"
    ? new x509.X509Crl(input)
    : new x509.X509Crl(new Uint8Array(input));

/** A list, PEM or DER. @throws Error if it is neither. */
export const parseCrl = (input: string | Uint8Array): ParsedCrl => {
  const crl = load(input);
  const number = crl.getExtension(CRL_NUMBER);
  return {
    der: bytes(new Uint8Array(crl.rawData)),
    issuer: rfc4514(crl.issuerName),
    number: number ? derInteger(number.value) : undefined,
    thisUpdate: crl.thisUpdate,
    nextUpdate: crl.nextUpdate,
    entries: crl.entries.map((entry) => ({
      serial: normaliseSerial(entry.serialNumber),
      revokedAt: entry.revocationDate,
      reason: REASONS[entry.reason ?? 0] ?? "unspecified",
    })),
  };
};

/** Whether the list is signed by the CA whose certificate this is. */
export const crlSignedBy = async (
  input: string | Uint8Array,
  issuerPem: string,
): Promise<boolean> => {
  try {
    return await load(input).verify({
      publicKey: new x509.X509Certificate(issuerPem),
    });
  } catch {
    return false;
  }
};

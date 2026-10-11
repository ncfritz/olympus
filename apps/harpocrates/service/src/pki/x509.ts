/**
 * Reading certificates, CSRs and keys. The service parses and checks; it
 * never signs (the signer does) and never holds a private key.
 */
import * as x509 from "@peculiar/x509";
import {
  createHash,
  createPublicKey,
  randomBytes,
  verify as verifySignature,
  webcrypto,
  X509Certificate,
} from "crypto";
import { KEY_ALGORITHM_VALUES, type KeyAlgorithmName } from "../model/common";

x509.cryptoProvider.set(webcrypto as unknown as Crypto);

export const OID = {
  serverAuth: "1.3.6.1.5.5.7.3.1",
  clientAuth: "1.3.6.1.5.5.7.3.2",
  codeSigning: "1.3.6.1.5.5.7.3.3",
  emailProtection: "1.3.6.1.5.5.7.3.4",
  documentSigning: "1.3.6.1.5.5.7.3.36",
} as const;

export type NameType = "dns" | "ip" | "email" | "uri";

export type SubjectNames = { type: NameType; value: string }[];

/** A PEM block: base64 in 64-column lines between the markers. */
export const toPem = (der: Uint8Array, label: string): string => {
  const base64 = Buffer.from(der).toString("base64");
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
};

export const certificatePem = (der: Uint8Array): string =>
  toPem(der, "CERTIFICATE");

export const certificateDer = (pem: string): Buffer =>
  Buffer.from(new X509Certificate(pem).raw);

/** A copy Prisma takes as `Bytes` (its own ArrayBuffer). */
export const bytes = (data: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(data);

/** Hex SHA-256 of a DER SubjectPublicKeyInfo: a key's identity everywhere. */
export const spkiSha256 = (spki: Uint8Array): string =>
  createHash("sha256").update(spki).digest("hex");

export const spkiPem = (spki: Uint8Array): string => toPem(spki, "PUBLIC KEY");

export const spkiFromPem = (pem: string): Buffer =>
  Buffer.from(
    pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/\s+/g, ""),
    "base64",
  );

/** 159 random bits, positive and non-zero, in hex (ADR 0020, Serials). */
export const randomSerial = (): string => {
  for (;;) {
    const bytes = randomBytes(20);
    bytes[0] &= 0x7f;
    const hex = bytes.toString("hex").replace(/^0+/, "");
    if (hex.length > 0) return hex;
  }
};

export type ParsedCertificate = {
  der: Uint8Array<ArrayBuffer>;
  subject: string;
  issuer: string;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  spki: Buffer;
  ca: boolean;
  pathLength?: number;
};

const escapeValue = (value: string): string =>
  value.replace(/([,+"\\<>;=])/g, "\\$1").replace(/^([ #])/, "\\$1");

/**
 * RFC 4514, as the signer and OpenSSL's -nameopt RFC2253 write it: the
 * last RDN first, `,` between RDNs, `+` within one. (@peculiar's own
 * toString() keeps the DER order, which no parser reads back the same way.)
 */
export const rfc4514 = (name: x509.Name): string =>
  name
    .toJSON()
    .slice()
    .reverse()
    .map((rdn) =>
      Object.entries(rdn)
        .flatMap(([type, values]) =>
          values.map((value) => `${type}=${escapeValue(value)}`),
        )
        .join("+"),
    )
    .join(",");

export const parseCertificate = (pem: string): ParsedCertificate => {
  const node = new X509Certificate(pem);
  const peculiar = new x509.X509Certificate(pem);
  const constraints = peculiar.getExtension(x509.BasicConstraintsExtension);
  return {
    der: bytes(node.raw),
    subject: rfc4514(peculiar.subjectName),
    issuer: rfc4514(peculiar.issuerName),
    serial: node.serialNumber.toLowerCase().replace(/^0+/, ""),
    notBefore: new Date(node.validFrom),
    notAfter: new Date(node.validTo),
    spki: node.publicKey.export({ type: "spki", format: "der" }),
    ca: constraints?.ca ?? false,
    pathLength: constraints?.pathLength,
  };
};

/** Whether `child` is signed by `parent`'s key. */
export const isIssuedBy = (childPem: string, parentPem: string): boolean => {
  const child = new X509Certificate(childPem);
  const parent = new X509Certificate(parentPem);
  return child.checkIssued(parent) && child.verify(parent.publicKey);
};

export type ParsedCsr = {
  pem: string;
  der: Buffer;
  spki: Buffer;
  /** What the CSR asks for; the profile, not the CSR, decides. */
  subject: string;
  names: SubjectNames;
  signatureValid: boolean;
  algorithm: string;
  /** The hash its signature uses; none for Ed25519. */
  signatureHash?: string;
  /** The key usages it asks for, if it asks (as the API names them). */
  keyUsages?: string[];
  /** The extended key usages it asks for, if it asks. */
  extendedKeyUsages?: string[];
};

/** Signature algorithms by OID, to the hash each uses. */
const SIGNATURE_HASHES: Record<string, string> = {
  "1.2.840.113549.1.1.5": "sha1",
  "1.2.840.113549.1.1.14": "sha224",
  "1.2.840.113549.1.1.11": "sha256",
  "1.2.840.113549.1.1.12": "sha384",
  "1.2.840.113549.1.1.13": "sha512",
  "1.2.840.10045.4.1": "sha1",
  "1.2.840.10045.4.3.1": "sha224",
  "1.2.840.10045.4.3.2": "sha256",
  "1.2.840.10045.4.3.3": "sha384",
  "1.2.840.10045.4.3.4": "sha512",
  "1.2.840.10040.4.3": "sha1",
  "2.16.840.1.101.3.4.3.1": "sha224",
  "2.16.840.1.101.3.4.3.2": "sha256",
  "2.16.840.1.101.3.4.3.3": "sha384",
  "2.16.840.1.101.3.4.3.4": "sha512",
};

/** A signature's hash, from Web Crypto's description or its OID. */
const signatureHashOf = (algorithm: {
  name: string;
  hash?: { name: string };
}): string | undefined =>
  algorithm.hash
    ? algorithm.hash.name.toLowerCase().replace("-", "")
    : SIGNATURE_HASHES[algorithm.name];

const KEY_USAGE_FLAGS: [x509.KeyUsageFlags, string][] = [
  [x509.KeyUsageFlags.digitalSignature, "digital_signature"],
  [x509.KeyUsageFlags.nonRepudiation, "content_commitment"],
  [x509.KeyUsageFlags.keyEncipherment, "key_encipherment"],
  [x509.KeyUsageFlags.dataEncipherment, "data_encipherment"],
  [x509.KeyUsageFlags.keyAgreement, "key_agreement"],
  [x509.KeyUsageFlags.keyCertSign, "key_cert_sign"],
  [x509.KeyUsageFlags.cRLSign, "crl_sign"],
];

/** The usages a CSR or certificate's extensions name, if they name any. */
export const usagesOf = (
  extensions: readonly x509.Extension[],
): { keyUsages?: string[]; extendedKeyUsages?: string[] } => {
  const ku = extensions.find(
    (e): e is x509.KeyUsagesExtension => e instanceof x509.KeyUsagesExtension,
  );
  const eku = extensions.find(
    (e): e is x509.ExtendedKeyUsageExtension =>
      e instanceof x509.ExtendedKeyUsageExtension,
  );
  return {
    keyUsages: ku
      ? KEY_USAGE_FLAGS.filter(([flag]) => ku.usages & flag).map(([, n]) => n)
      : undefined,
    extendedKeyUsages: eku ? eku.usages.map((u) => String(u)) : undefined,
  };
};

/** A certificate's usages, as a renewal carries them over. */
export const certificateUsages = (pem: string) =>
  usagesOf(new x509.X509Certificate(pem).extensions);

/** The alternative names in a SubjectAlternativeName extension. */
const sanNames = (extensions: readonly x509.Extension[]): SubjectNames => {
  const names: SubjectNames = [];
  const san = extensions.find(
    (extension): extension is x509.SubjectAlternativeNameExtension =>
      extension instanceof x509.SubjectAlternativeNameExtension,
  );
  for (const name of san?.names.items ?? []) {
    if (name.type === "dns") names.push({ type: "dns", value: name.value });
    if (name.type === "ip") names.push({ type: "ip", value: name.value });
    if (name.type === "email") names.push({ type: "email", value: name.value });
    if (name.type === "url") names.push({ type: "uri", value: name.value });
  }
  return names;
};

/** A certificate's alternative names. */
export const certificateNames = (pem: string): SubjectNames =>
  sanNames(new x509.X509Certificate(pem).extensions);

/** Each certificate in PEM text (a bundle), or the one DER certificate. */
export const splitCertificates = (data: string | Buffer): string[] => {
  const text = typeof data === "string" ? data : data.toString("latin1");
  const pems =
    text.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
    ) ?? [];
  if (pems.length > 0) return pems.map((pem) => `${pem}\n`);
  return typeof data === "string" ? [] : [certificatePem(data)];
};

/** DSA's signature algorithms, by OID: Web Crypto has no DSA. */
const DSA_HASHES: Record<string, string> = {
  "2.16.840.1.101.3.4.3.1": "sha224",
  "2.16.840.1.101.3.4.3.2": "sha256",
  "2.16.840.1.101.3.4.3.3": "sha384",
  "2.16.840.1.101.3.4.3.4": "sha512",
};

/** The first element inside a DER SEQUENCE, whole: a CSR's signed part. */
const firstElement = (der: Buffer): Buffer => {
  const lengthAt = (at: number): { length: number; start: number } => {
    const first = der[at];
    if (first < 0x80) return { length: first, start: at + 1 };
    const count = first & 0x7f;
    return { length: der.readUIntBE(at + 1, count), start: at + 1 + count };
  };
  const outer = lengthAt(1);
  const inner = lengthAt(outer.start + 1);
  return der.subarray(outer.start, inner.start + inner.length);
};

/** Whether a CSR is signed by its own key: proof of possession. */
const verifyCsr = async (
  csr: x509.Pkcs10CertificateRequest,
  spki: Buffer,
): Promise<boolean> => {
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "dsa") return csr.verify();
  const hash = DSA_HASHES[csr.signatureAlgorithm.name];
  return hash
    ? verifySignature(
        hash,
        firstElement(Buffer.from(csr.rawData)),
        key,
        Buffer.from(csr.signature),
      )
    : false;
};

export const parseCsr = async (pem: string): Promise<ParsedCsr> => {
  const csr = new x509.Pkcs10CertificateRequest(pem);
  const names = sanNames(csr.extensions);
  const spki = Buffer.from(csr.publicKey.rawData);
  return {
    pem,
    der: Buffer.from(csr.rawData),
    spki,
    subject: rfc4514(csr.subjectName),
    names,
    signatureValid: await verifyCsr(csr, spki),
    algorithm: keyAlgorithm(spki),
    signatureHash: signatureHashOf(
      csr.signatureAlgorithm as { name: string; hash?: { name: string } },
    ),
    ...usagesOf(csr.extensions),
  };
};

/**
 * `P-256`, `P-384`, `P-521`, `RSA-<bits>`, `DSA-<bits>` or `Ed25519`, from
 * a SubjectPublicKeyInfo.
 */
export const keyAlgorithm = (spki: Buffer): string => {
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  const details = key.asymmetricKeyDetails ?? {};
  if (key.asymmetricKeyType === "ec") {
    const curves: Record<string, string> = {
      prime256v1: "P-256",
      secp384r1: "P-384",
      secp521r1: "P-521",
    };
    return curves[details.namedCurve ?? ""] ?? `EC-${details.namedCurve}`;
  }
  if (key.asymmetricKeyType === "rsa") return `RSA-${details.modulusLength}`;
  if (key.asymmetricKeyType === "dsa") return `DSA-${details.modulusLength}`;
  return key.asymmetricKeyType === "ed25519" ? "Ed25519" : "unknown";
};

/**
 * Whether Harpocrates certifies a key of this type (ADR 0020, amended): RSA
 * or DSA of at least 2048 bits, a NIST curve, or Ed25519. What the signer
 * accepts.
 */
export const certifiable = (algorithm: string): boolean => {
  const sized = /^(RSA|DSA)-(\d+)$/.exec(algorithm);
  if (sized) return Number(sized[2]) >= 2048;
  return ["P-256", "P-384", "P-521", "Ed25519"].includes(algorithm);
};

/** The algorithm, if the signer generates keys of it. */
export const generatable = (algorithm: string): KeyAlgorithmName | undefined =>
  (KEY_ALGORITHM_VALUES as readonly string[]).includes(algorithm)
    ? (algorithm as KeyAlgorithmName)
    : undefined;

/** The RSA modulus of a SubjectPublicKeyInfo, or undefined for other keys. */
export const rsaModulus = (spki: Buffer): bigint | undefined => {
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "rsa") return undefined;
  const jwk = key.export({ format: "jwk" });
  return BigInt(`0x${Buffer.from(jwk.n ?? "", "base64url").toString("hex")}`);
};

/** An RFC 4514 name from its parts, most significant last (CN first). */
export const subjectName = (parts: {
  commonName: string;
  organizationalUnit?: string;
  organization?: string;
}): string =>
  [
    `CN=${escapeValue(parts.commonName)}`,
    parts.organizationalUnit && `OU=${escapeValue(parts.organizationalUnit)}`,
    parts.organization && `O=${escapeValue(parts.organization)}`,
  ]
    .filter(Boolean)
    .join(",");

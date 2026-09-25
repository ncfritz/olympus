/**
 * Reading certificates, CSRs and keys. The service parses and checks; it
 * never signs (the signer does) and never holds a private key.
 */
import * as x509 from "@peculiar/x509";
import {
  createHash,
  createPublicKey,
  randomBytes,
  webcrypto,
  X509Certificate,
} from "crypto";

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
};

export const parseCsr = async (pem: string): Promise<ParsedCsr> => {
  const csr = new x509.Pkcs10CertificateRequest(pem);
  const names: SubjectNames = [];
  const san = csr.extensions.find(
    (extension): extension is x509.SubjectAlternativeNameExtension =>
      extension instanceof x509.SubjectAlternativeNameExtension,
  );
  for (const name of san?.names.items ?? []) {
    if (name.type === "dns") names.push({ type: "dns", value: name.value });
    if (name.type === "ip") names.push({ type: "ip", value: name.value });
    if (name.type === "email") names.push({ type: "email", value: name.value });
    if (name.type === "url") names.push({ type: "uri", value: name.value });
  }
  return {
    pem,
    der: Buffer.from(csr.rawData),
    spki: Buffer.from(csr.publicKey.rawData),
    subject: rfc4514(csr.subjectName),
    names,
    signatureValid: await csr.verify(),
    algorithm: keyAlgorithm(Buffer.from(csr.publicKey.rawData)),
  };
};

/** `P-256`, `P-384`, `RSA-<bits>` or `Ed25519`, from a SubjectPublicKeyInfo. */
export const keyAlgorithm = (spki: Buffer): string => {
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  const details = key.asymmetricKeyDetails ?? {};
  if (key.asymmetricKeyType === "ec") {
    const curves: Record<string, string> = {
      prime256v1: "P-256",
      secp384r1: "P-384",
    };
    return curves[details.namedCurve ?? ""] ?? `EC-${details.namedCurve}`;
  }
  if (key.asymmetricKeyType === "rsa") return `RSA-${details.modulusLength}`;
  return key.asymmetricKeyType === "ed25519" ? "Ed25519" : "unknown";
};

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

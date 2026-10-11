import "reflect-metadata";
import * as x509 from "@peculiar/x509";
import { ekuName } from "./labels";

/** One extension, as the console shows it. */
export type ExtensionDetail = {
  oid: string;
  name: string;
  critical: boolean;
  /** What it says, a line each. */
  values: string[];
};

/** A certificate, read from its PEM in the browser. */
export type CertificateDetail = {
  serial: string;
  sha256: string;
  sha1: string;
  signatureAlgorithm: string;
  publicKey: string;
  extensions: ExtensionDetail[];
  pem: string;
};

const EXTENSION_NAMES: Record<string, string> = {
  "2.5.29.19": "Basic constraints",
  "2.5.29.15": "Key usage",
  "2.5.29.37": "Extended key usage",
  "2.5.29.14": "Subject key identifier",
  "2.5.29.35": "Authority key identifier",
  "2.5.29.17": "Subject alternative names",
  "2.5.29.31": "CRL distribution points",
  "1.3.6.1.5.5.7.1.1": "Authority information access",
  "2.5.29.30": "Name constraints",
  "2.5.29.32": "Certificate policies",
};

const KEY_USAGES: [x509.KeyUsageFlags, string][] = [
  [x509.KeyUsageFlags.digitalSignature, "digitalSignature"],
  [x509.KeyUsageFlags.nonRepudiation, "nonRepudiation"],
  [x509.KeyUsageFlags.keyEncipherment, "keyEncipherment"],
  [x509.KeyUsageFlags.dataEncipherment, "dataEncipherment"],
  [x509.KeyUsageFlags.keyAgreement, "keyAgreement"],
  [x509.KeyUsageFlags.keyCertSign, "keyCertSign"],
  [x509.KeyUsageFlags.cRLSign, "cRLSign"],
  [x509.KeyUsageFlags.encipherOnly, "encipherOnly"],
  [x509.KeyUsageFlags.decipherOnly, "decipherOnly"],
];

/** Hex, upper case, a colon between bytes: as fingerprints are shown. */
export const colonHex = (bytes: ArrayBuffer | string): string =>
  (typeof bytes === "string"
    ? bytes
    : Array.from(new Uint8Array(bytes), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("")
  )
    .toUpperCase()
    .match(/.{1,2}/g)!
    .join(":");

const generalName = (name: { type: string; value: string }): string =>
  name.type === "url" ? name.value : `${name.type}: ${name.value}`;

/** What one extension says, in lines; its value hex when not known. */
const valuesOf = (extension: x509.Extension): string[] => {
  if (extension instanceof x509.BasicConstraintsExtension) {
    return [
      extension.ca ? "CA" : "Not a CA",
      ...(extension.pathLength !== undefined
        ? [`Path length ${extension.pathLength}`]
        : []),
    ];
  }
  if (extension instanceof x509.KeyUsagesExtension) {
    return KEY_USAGES.filter(([flag]) => extension.usages & flag).map(
      ([, name]) => name,
    );
  }
  if (extension instanceof x509.ExtendedKeyUsageExtension) {
    return extension.usages.map((usage) => ekuName(String(usage)));
  }
  if (extension instanceof x509.SubjectKeyIdentifierExtension) {
    return [colonHex(extension.keyId)];
  }
  if (extension instanceof x509.AuthorityKeyIdentifierExtension) {
    return extension.keyId ? [colonHex(extension.keyId)] : [];
  }
  if (extension instanceof x509.SubjectAlternativeNameExtension) {
    return extension.names.items.map((name) => `${name.type}: ${name.value}`);
  }
  if (extension instanceof x509.CRLDistributionPointsExtension) {
    return extension.distributionPoints.flatMap(
      (point) =>
        point.distributionPoint?.fullName?.flatMap((name) =>
          name.uniformResourceIdentifier
            ? [name.uniformResourceIdentifier]
            : [],
        ) ?? [],
    );
  }
  if (extension instanceof x509.AuthorityInfoAccessExtension) {
    return [
      ...extension.caIssuers.map((n) => `CA issuers: ${generalName(n)}`),
      ...extension.ocsp.map((n) => `OCSP: ${generalName(n)}`),
    ];
  }
  return [colonHex(extension.value)];
};

const describeKey = (algorithm: Algorithm & Record<string, unknown>): string =>
  algorithm.namedCurve
    ? `${algorithm.name} ${String(algorithm.namedCurve)}`
    : algorithm.modulusLength
      ? `${algorithm.name} ${String(algorithm.modulusLength)}-bit`
      : algorithm.name;

/** The name constraints extension, which this library does not decode. */
export const NAME_CONSTRAINTS_OID = "2.5.29.30";

/** A certificate's details, from its PEM. */
export const readCertificate = async (
  pem: string,
): Promise<CertificateDetail> => {
  const certificate = new x509.X509Certificate(pem);
  const signature = certificate.signatureAlgorithm as Algorithm & {
    hash?: Algorithm;
  };
  return {
    serial: colonHex(certificate.serialNumber),
    sha256: colonHex(await certificate.getThumbprint("SHA-256")),
    sha1: colonHex(await certificate.getThumbprint("SHA-1")),
    signatureAlgorithm: signature.hash
      ? `${signature.name} with ${signature.hash.name}`
      : signature.name,
    publicKey: describeKey(
      certificate.publicKey.algorithm as Algorithm & Record<string, unknown>,
    ),
    extensions: certificate.extensions.map((extension) => ({
      oid: extension.type,
      name: EXTENSION_NAMES[extension.type] ?? extension.type,
      critical: extension.critical,
      values: valuesOf(extension),
    })),
    pem: certificate.toString("pem"),
  };
};

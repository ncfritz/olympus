import "reflect-metadata";
import * as x509 from "@peculiar/x509";
import { commonName } from "./tree";

/**
 * Files dropped or chosen in the console, read in the browser: PEM as it
 * is, DER wrapped as PEM, a PKCS#12 file as base64; and what each holds,
 * said in a line, so a wrong file is seen before it is sent.
 */

/** What a file input takes. */
export type PemKind =
  "certificate" | "certificates" | "csr" | "key" | "crl" | "pkcs12";

/** The PEM label DER of each kind is wrapped in. */
const LABELS: Record<Exclude<PemKind, "pkcs12">, string> = {
  certificate: "CERTIFICATE",
  certificates: "CERTIFICATE",
  csr: "CERTIFICATE REQUEST",
  key: "ENCRYPTED PRIVATE KEY",
  crl: "X509 CRL",
};

/** The file extensions each kind's input offers. */
export const ACCEPT: Record<PemKind, string> = {
  certificate: ".pem,.crt,.cer,.der",
  certificates: ".pem,.crt,.cer,.der",
  csr: ".pem,.csr,.req,.der",
  key: ".pem,.key,.p8,.pk8,.der",
  crl: ".pem,.crl,.der",
  pkcs12: ".p12,.pfx",
};

const base64Of = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** DER as PEM, under a label, 64 characters a line. */
export const pemOf = (der: Uint8Array, label: string): string =>
  `-----BEGIN ${label}-----\n${
    base64Of(der)
      .match(/.{1,64}/g)
      ?.join("\n") ?? ""
  }\n-----END ${label}-----\n`;

/** A file's contents as the service takes them for its kind. */
export const readFile = async (file: File, kind: PemKind): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "pkcs12") return base64Of(bytes);
  const text = new TextDecoder().decode(bytes);
  return text.includes("-----BEGIN") ? text : pemOf(bytes, LABELS[kind]);
};

/** Every PEM block in a text, with its label. */
export const blocksOf = (text: string): { label: string; pem: string }[] =>
  [
    ...text.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END \1-----/g),
  ].map((match) => ({ label: match[1], pem: match[0] }));

/** What a file input's value holds, a line each, or what is wrong. */
export type PemSummary = { lines: string[]; problem?: string };

const day = (date: Date) =>
  date.toLocaleDateString(undefined, { dateStyle: "medium" });

/** A certificate in a line: its name, its issuer, and its validity. */
const certificateLine = (pem: string): string => {
  const c = new x509.X509Certificate(pem);
  const ca = c.getExtension(x509.BasicConstraintsExtension)?.ca;
  const self = c.subject === c.issuer;
  return `${commonName(c.subject.replace(/, /g, ","))}${ca ? " (CA)" : ""}: ${
    self
      ? "self-signed"
      : `issued by ${commonName(c.issuer.replace(/, /g, ","))}`
  }, ${day(c.notBefore)} to ${day(c.notAfter)}`;
};

/** What a value holds, read as its kind. */
export const summarise = (value: string, kind: PemKind): PemSummary => {
  if (kind === "pkcs12") return { lines: ["A PKCS#12 file"] };
  const blocks = blocksOf(value);
  try {
    switch (kind) {
      case "certificate":
      case "certificates": {
        const certificates = blocks.filter((b) => b.label === "CERTIFICATE");
        if (certificates.length === 0) {
          return { lines: [], problem: "No PEM certificate here" };
        }
        if (kind === "certificate" && certificates.length > 1) {
          return {
            lines: [],
            problem: `${certificates.length} certificates here: one is wanted`,
          };
        }
        const lines = certificates.map((b) => certificateLine(b.pem));
        return kind === "certificates" && lines.length > 3
          ? {
              lines: [
                `${lines.length} certificates`,
                ...lines.slice(0, 3),
                `and ${lines.length - 3} more`,
              ],
            }
          : { lines };
      }
      case "csr": {
        const block = blocks.find((b) => b.label === "CERTIFICATE REQUEST");
        if (!block)
          return { lines: [], problem: "No PEM certificate request here" };
        const csr = new x509.Pkcs10CertificateRequest(block.pem);
        return {
          lines: [
            `Request for ${csr.subject || "an empty subject"}, ${csr.publicKey.algorithm.name}`,
          ],
        };
      }
      case "crl": {
        const block = blocks.find((b) => b.label === "X509 CRL");
        if (!block)
          return { lines: [], problem: "No PEM revocation list here" };
        const crl = new x509.X509Crl(block.pem);
        return {
          lines: [
            `List from ${commonName(crl.issuer.replace(/, /g, ","))}: ${crl.entries.length} revoked, next by ${crl.nextUpdate ? day(crl.nextUpdate) : "—"}`,
          ],
        };
      }
      case "key": {
        if (blocks.some((b) => b.label === "ENCRYPTED PRIVATE KEY")) {
          return { lines: ["An encrypted private key (PKCS#8)"] };
        }
        if (blocks.some((b) => b.label.endsWith("PRIVATE KEY"))) {
          return {
            lines: [],
            problem:
              "An unencrypted key: export it again encrypted (PKCS#8 with a password)",
          };
        }
        return { lines: [], problem: "No PEM private key here" };
      }
    }
  } catch {
    return { lines: [], problem: "This could not be read" };
  }
};

import * as peculiar from "@peculiar/x509";
import { generateKeyPairSync, type KeyObject, webcrypto } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import {
  certifiable,
  generatable,
  isMustStaple,
  keyAlgorithm,
  parseCsr,
  parseCertificate,
  randomSerial,
  spkiFromPem,
  spkiPem,
  subjectName,
  toPem,
} from "../../../src/pki/x509";
import { selfSignedTls } from "../../support/tls";

describe("x509 helpers", () => {
  it("makes 159-bit positive serials", () => {
    for (let i = 0; i < 200; i += 1) {
      const serial = BigInt(`0x${randomSerial()}`);
      expect(serial > 0n && serial < 2n ** 159n).toBe(true);
    }
  });

  it("round-trips a public key through PEM", () => {
    const spki = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    }).publicKey.export({
      type: "spki",
      format: "der",
    });
    expect(spkiFromPem(spkiPem(spki)).equals(spki)).toBe(true);
    expect(keyAlgorithm(spki)).toBe("P-256");
  });

  it("names each key type the signer takes", () => {
    const spki = (key: { publicKey: KeyObject }) =>
      key.publicKey.export({ type: "spki", format: "der" });
    expect(
      keyAlgorithm(spki(generateKeyPairSync("ec", { namedCurve: "P-521" }))),
    ).toBe("P-521");
    expect(keyAlgorithm(spki(generateKeyPairSync("ed25519")))).toBe("Ed25519");
    expect(
      keyAlgorithm(spki(generateKeyPairSync("rsa", { modulusLength: 3072 }))),
    ).toBe("RSA-3072");
    expect(
      keyAlgorithm(
        spki(
          generateKeyPairSync("dsa", {
            modulusLength: 2048,
            divisorLength: 256,
          }),
        ),
      ),
    ).toBe("DSA-2048");
  });

  it("certifies RSA and DSA from 2048 bits, the NIST curves and Ed25519", () => {
    for (const algorithm of [
      "RSA-2048",
      "RSA-2560",
      "DSA-3072",
      "P-256",
      "P-384",
      "P-521",
      "Ed25519",
    ]) {
      expect(certifiable(algorithm)).toBe(true);
    }
    for (const algorithm of [
      "RSA-1024",
      "DSA-1024",
      "EC-secp256k1",
      "unknown",
    ]) {
      expect(certifiable(algorithm)).toBe(false);
    }
    expect(generatable("RSA-4096")).toBe("RSA-4096");
    expect(generatable("RSA-2560")).toBeUndefined();
  });

  it("verifies a DSA CSR's signature, which Web Crypto cannot", async () => {
    const pem = fs.readFileSync(
      path.join(__dirname, "../../fixtures/dsa-2048.csr"),
      "utf8",
    );
    const csr = await parseCsr(pem);
    expect(csr).toMatchObject({ algorithm: "DSA-2048", signatureValid: true });
    const der = Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ""), "base64");
    der[der.length - 2] ^= 0xff;
    const tampered = `-----BEGIN CERTIFICATE REQUEST-----\n${der.toString("base64")}\n-----END CERTIFICATE REQUEST-----\n`;
    expect((await parseCsr(tampered)).signatureValid).toBe(false);
  });

  it("escapes RFC 4514 special characters", () => {
    expect(
      subjectName({
        commonName: "a,b",
        organizationalUnit: "prod",
        organization: "ncfritz.net",
      }),
    ).toBe("CN=a\\,b,OU=prod,O=ncfritz.net");
  });

  it("reads a certificate's names back in the RFC 4514 form they were written in", async () => {
    const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
    const keys = (await webcrypto.subtle.generateKey(algorithm, false, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const name = subjectName({
      commonName: "a,b",
      organizationalUnit: "prod",
      organization: "ncfritz.net",
    });
    // The signer writes the name the way cryptography parses it: the last
    // RDN in the string is the first in the certificate.
    const certificate =
      await peculiar.X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name: "O=ncfritz.net, OU=prod, CN=a\\,b",
        keys,
        signingAlgorithm: algorithm,
      });
    const parsed = parseCertificate(certificate.toString("pem"));
    expect(parsed.subject).toBe(name);
    expect(parsed.issuer).toBe(name);
  });

  it("reads must-staple from a TLS feature naming status_request", async () => {
    expect(isMustStaple((await selfSignedTls("a", [5])).der)).toBe(true);
    expect(isMustStaple((await selfSignedTls("b", [17, 5])).der)).toBe(true);
    // status_request_v2 alone is not must-staple.
    expect(isMustStaple((await selfSignedTls("c", [17])).der)).toBe(false);
    expect(isMustStaple((await selfSignedTls("d")).der)).toBe(false);
  });

  it("wraps PEM at 64 columns", () => {
    const pem = toPem(new Uint8Array(100), "TEST");
    expect(pem.split("\n")[1]).toHaveLength(64);
  });
});

import * as peculiar from "@peculiar/x509";
import { generateKeyPairSync, webcrypto } from "crypto";
import { describe, expect, it } from "vitest";
import {
  keyAlgorithm,
  parseCertificate,
  randomSerial,
  spkiFromPem,
  spkiPem,
  subjectName,
  toPem,
} from "../../../src/pki/x509";

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

  it("wraps PEM at 64 columns", () => {
    const pem = toPem(new Uint8Array(100), "TEST");
    expect(pem.split("\n")[1]).toHaveLength(64);
  });
});

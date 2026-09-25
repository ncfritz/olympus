import * as x509 from "@peculiar/x509";
import { webcrypto } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { crlSignedBy, normaliseSerial, parseCrl } from "../../../src/pki/crl";

const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };

const number = (hex: string) =>
  new x509.Extension(
    "2.5.29.20",
    false,
    new Uint8Array([0x02, hex.length / 2, ...Buffer.from(hex, "hex")]),
  );

describe("revocation lists", () => {
  let ca: x509.X509Certificate;
  let keys: CryptoKeyPair;
  let pem: string;

  beforeAll(async () => {
    keys = (await webcrypto.subtle.generateKey(algorithm, false, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    ca = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: "01",
      name: "O=ncfritz.net, CN=Test CA",
      keys,
      signingAlgorithm: algorithm,
    });
    const crl = await x509.X509CrlGenerator.create({
      issuer: ca.subjectName,
      thisUpdate: new Date("2026-09-01T00:00:00Z"),
      nextUpdate: new Date("2026-09-08T00:00:00Z"),
      entries: [
        {
          serialNumber: "00ab01",
          revocationDate: new Date("2026-08-30T00:00:00Z"),
          reason: x509.X509CrlReason.keyCompromise,
        },
        {
          serialNumber: "7f",
          revocationDate: new Date("2026-08-31T00:00:00Z"),
        },
      ],
      // 300: a number past one octet.
      extensions: [number("012c")],
      signingKey: keys.privateKey,
      signingAlgorithm: algorithm,
    });
    pem = crl.toString("pem");
  });

  it("reads the number, the dates, the issuer and the entries", () => {
    const parsed = parseCrl(pem);
    expect(parsed.number).toBe(300n);
    expect(parsed.issuer).toBe("CN=Test CA,O=ncfritz.net");
    expect(parsed.thisUpdate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(parsed.nextUpdate?.toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(parsed.entries).toEqual([
      {
        serial: "ab01",
        revokedAt: new Date("2026-08-30T00:00:00Z"),
        reason: "keyCompromise",
      },
      {
        serial: "7f",
        revokedAt: new Date("2026-08-31T00:00:00Z"),
        reason: "unspecified",
      },
    ]);
  });

  it("reads DER as PEM", () => {
    const der = parseCrl(pem).der;
    expect(parseCrl(der).number).toBe(300n);
  });

  it("checks the signature against the CA's certificate", async () => {
    expect(await crlSignedBy(pem, ca.toString("pem"))).toBe(true);
    const other = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: "02",
      name: "O=ncfritz.net, CN=Test CA",
      keys: (await webcrypto.subtle.generateKey(algorithm, false, [
        "sign",
        "verify",
      ])) as CryptoKeyPair,
      signingAlgorithm: algorithm,
    });
    expect(await crlSignedBy(pem, other.toString("pem"))).toBe(false);
    expect(await crlSignedBy("not a list", ca.toString("pem"))).toBe(false);
  });

  it("keeps serials as certificates' are kept", () => {
    expect(normaliseSerial("00AB01")).toBe("ab01");
    expect(normaliseSerial("00")).toBe("0");
  });
});

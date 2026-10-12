import * as peculiar from "@peculiar/x509";
import { webcrypto } from "crypto";

/** A TLS feature extension's value: a SEQUENCE OF small INTEGERs. */
const tlsFeature = (features: number[]): Uint8Array<ArrayBuffer> => {
  const body = features.flatMap((feature) => [0x02, 0x01, feature]);
  return new Uint8Array([0x30, body.length, ...body]);
};

/**
 * A self-signed certificate and its key, for a TLS server in a test; with
 * `features`, a TLS feature extension (RFC 7633) naming them: [5] is
 * must-staple.
 */
export const selfSignedTls = async (
  commonName: string,
  features?: number[],
): Promise<{ cert: string; key: string; der: Uint8Array }> => {
  const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const keys = (await webcrypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const certificate = await peculiar.X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: `CN=${commonName}`,
    keys,
    signingAlgorithm: algorithm,
    extensions: features
      ? [
          new peculiar.Extension(
            "1.3.6.1.5.5.7.1.24",
            false,
            tlsFeature(features),
          ),
        ]
      : [],
  });
  const pkcs8 = await webcrypto.subtle.exportKey("pkcs8", keys.privateKey);
  return {
    cert: certificate.toString("pem"),
    key: peculiar.PemConverter.encode(pkcs8, "PRIVATE KEY"),
    der: new Uint8Array(certificate.rawData),
  };
};

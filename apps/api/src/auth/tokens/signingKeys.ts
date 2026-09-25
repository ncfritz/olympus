import * as fs from "fs";
import * as path from "path";
import * as jose from "jose";

/** One key the API can verify with, and possibly sign with. */
export type SigningKey = {
  /**
   * RFC 7638 thumbprint of the public key. The `kid` is derived from the
   * key itself rather than from its filename, so renaming a file cannot
   * silently change which key a token claims to have been signed by, and a
   * key that is copied between environments keeps its identity.
   */
  kid: string;
  /** The file it came from, for logs — never part of the token. */
  source: string;
  privateKey: jose.CryptoKey;
  /**
   * Imported separately: a key from `importPKCS8` can only sign — WebCrypto
   * gives it the "sign" usage alone — so verification needs the public half
   * as a key of its own, not the private one.
   */
  publicKey: jose.CryptoKey;
  publicJwk: jose.JWK;
};

export type SigningKeys = {
  /** The key that signs new tokens: the last by filename. */
  signer: SigningKey;
  /** Every key, by `kid`: a token signed by a retired key still verifies. */
  byKid: Map<string, SigningKey>;
  /** What `/.well-known/jwks.json` serves. */
  jwks: { keys: jose.JWK[] };
};

const PEM = /\.pem$/;

/**
 * Loads the ES256 keys in a directory (ADR 0018): every key verifies, the
 * newest signs, and rotation is dropping a file in and restarting.
 *
 * "Newest" is the last filename in sort order, so the names have to sort
 * chronologically — `2026-09-24.pem`, or a prefix that does. That is a
 * convention rather than something the filesystem guarantees, which is why
 * the chosen signer is worth logging at startup.
 */
export const loadSigningKeys = async (
  directory: string,
): Promise<SigningKeys> => {
  const files = fs
    .readdirSync(directory)
    .filter((name) => PEM.test(name))
    .sort();
  if (files.length === 0) {
    throw new Error(`no .pem files in ${directory}`);
  }

  const keys: SigningKey[] = [];
  for (const file of files) {
    const pem = fs.readFileSync(path.join(directory, file), "utf8");
    const privateKey = await jose.importPKCS8(pem, "ES256", {
      extractable: true,
    });
    const jwk = await jose.exportJWK(privateKey);
    // The public half only: d is the private scalar.
    const publicJwk: jose.JWK = {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      alg: "ES256",
      use: "sig",
    };
    const kid = await jose.calculateJwkThumbprint(publicJwk, "sha256");
    const publicKey = await jose.importJWK(publicJwk, "ES256");
    if (!(publicKey instanceof CryptoKey)) {
      throw new Error(`${file} did not import as a key`);
    }
    keys.push({
      kid,
      source: file,
      privateKey,
      publicKey,
      publicJwk: { ...publicJwk, kid },
    });
  }

  const byKid = new Map(keys.map((key) => [key.kid, key]));
  if (byKid.size !== keys.length) {
    throw new Error(`${directory} holds the same key twice`);
  }

  return {
    signer: keys[keys.length - 1]!,
    byKid,
    jwks: { keys: keys.map((key) => key.publicJwk) },
  };
};

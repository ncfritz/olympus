import { Injectable } from "@nestjs/common";
import { createPublicKey, type KeyObject } from "crypto";
import * as jose from "jose";
import { Acme } from "../AcmeProblem";
import type { AcmeAccount } from "../../store/prisma";
import { PrismaService } from "../../store/PrismaService";
import { AcmeNonceService } from "./AcmeNonceService";
import { AcmeUrls } from "./AcmeUrls";

/** The signature algorithms accepted: RFC 8555 §6.2 requires ES256 and RS256. */
export const ACME_ALGORITHMS = [
  "ES256",
  "ES384",
  "ES512",
  "RS256",
  "PS256",
  "EdDSA",
];

/** A flattened JWS, as an ACME request's body is (RFC 8555 §6.2). */
export type FlattenedJws = {
  protected: string;
  payload: string;
  signature: string;
};

export type AcmeProtectedHeader = {
  alg: string;
  nonce?: string;
  url?: string;
  jwk?: jose.JWK;
  kid?: string;
};

/** A request whose signature, nonce and URL checked out. */
export type VerifiedRequest = {
  header: AcmeProtectedHeader;
  /** The payload, parsed; undefined for a POST-as-GET (§6.3). */
  payload: unknown;
  /** The key it was signed with. */
  key: KeyObject;
  /** For a `kid` request, its account. */
  account?: AcmeAccount;
  /** For a `jwk` request, the key as sent. */
  jwk?: jose.JWK;
};

const isFlattenedJws = (body: unknown): body is FlattenedJws => {
  if (typeof body !== "object" || body === null) return false;
  const jws = body as Record<string, unknown>;
  return (
    typeof jws.protected === "string" &&
    typeof jws.payload === "string" &&
    typeof jws.signature === "string"
  );
};

const decodeJson = (part: string, what: string): unknown => {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    throw Acme.malformed(`The ${what} is not base64url JSON`);
  }
};

/**
 * Request authentication (RFC 8555 §6.2–6.5): every ACME POST is a
 * flattened JWS whose protected header names the URL it was sent to, a
 * nonce Harpocrates handed out, and either the account (`kid`) or, for a
 * new account and some revocations, the key itself (`jwk`).
 */
@Injectable()
export class AcmeJwsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nonces: AcmeNonceService,
    private readonly urls: AcmeUrls,
  ) {}

  /**
   * Checks a request to `url`. `key` says which identification it must
   * use: `jwk` (new-account), `kid` (everything with an account), or
   * either (revoke-cert).
   */
  async verify(
    body: unknown,
    url: string,
    key: "jwk" | "kid" | "either",
  ): Promise<VerifiedRequest> {
    if (!isFlattenedJws(body)) {
      throw Acme.malformed(
        "The request is not a flattened JWS (protected, payload, signature)",
      );
    }
    if ("header" in (body as object)) {
      throw Acme.malformed("An ACME JWS has no unprotected header");
    }
    const header = decodeJson(
      body.protected,
      "protected header",
    ) as AcmeProtectedHeader;
    if (typeof header !== "object" || header === null) {
      throw Acme.malformed("The protected header is not an object");
    }
    if (!ACME_ALGORITHMS.includes(header.alg)) {
      throw Acme.badSignatureAlgorithm(
        `${String(header.alg)} is not accepted`,
        { algorithms: ACME_ALGORITHMS },
      );
    }
    if (header.url !== url) {
      throw Acme.unauthorized(
        `The JWS is for ${String(header.url)}, not ${url}`,
      );
    }
    if (header.jwk !== undefined && header.kid !== undefined) {
      throw Acme.malformed("The JWS has both jwk and kid");
    }
    if (key === "jwk" && header.jwk === undefined) {
      throw Acme.malformed("This request is signed with its key (jwk)");
    }
    if (key === "kid" && header.kid === undefined) {
      throw Acme.malformed("This request is signed by an account (kid)");
    }
    if (header.jwk === undefined && header.kid === undefined) {
      throw Acme.malformed("The JWS names no key (jwk or kid)");
    }
    if (typeof header.nonce !== "string" || !header.nonce) {
      throw Acme.badNonce("The JWS has no nonce");
    }
    if (!(await this.nonces.consume(header.nonce))) {
      throw Acme.badNonce("The nonce is unknown, used or expired");
    }

    let publicKey: KeyObject;
    let account: AcmeAccount | undefined;
    if (header.jwk !== undefined) {
      publicKey = this.jwkKey(header.jwk);
    } else {
      const accountId = this.urls.accountIdOf(String(header.kid));
      account = accountId
        ? ((await this.prisma.acmeAccount.findUnique({
            where: { id: accountId },
          })) ?? undefined)
        : undefined;
      if (!account) {
        throw Acme.accountDoesNotExist(`No account ${String(header.kid)}`);
      }
      if (account.status !== "valid") {
        throw Acme.unauthorized(`The account is ${account.status}`);
      }
      publicKey = createPublicKey({
        key: Buffer.from(account.publicKey),
        format: "der",
        type: "spki",
      });
    }

    let verified: jose.FlattenedVerifyResult;
    try {
      verified = await jose.flattenedVerify(body, publicKey, {
        algorithms: ACME_ALGORITHMS,
      });
    } catch (error) {
      throw Acme.malformed(
        `The JWS does not verify: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return {
      header,
      payload:
        body.payload === ""
          ? undefined
          : (() => {
              try {
                return JSON.parse(new TextDecoder().decode(verified.payload));
              } catch {
                throw Acme.malformed("The payload is not JSON");
              }
            })(),
      key: publicKey,
      account,
      jwk: header.jwk,
    };
  }

  /** A public key from a JWK: never a private one. */
  jwkKey(jwk: unknown): KeyObject {
    if (typeof jwk !== "object" || jwk === null) {
      throw Acme.malformed("The jwk is not a JSON Web Key");
    }
    if ("d" in jwk) throw Acme.badPublicKey("The jwk holds a private key");
    let key: KeyObject;
    try {
      key = createPublicKey({ key: jwk as jose.JWK, format: "jwk" } as never);
    } catch (error) {
      throw Acme.badPublicKey(
        `The jwk is not a usable public key: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const bits = key.asymmetricKeyDetails?.modulusLength;
    if (key.asymmetricKeyType === "rsa" && (bits ?? 0) < 2048) {
      throw Acme.badPublicKey(`An RSA key of ${bits} bits: 2048 at least`);
    }
    return key;
  }
}

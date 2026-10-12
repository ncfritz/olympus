import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import {
  certIdHashes,
  type CertIdHash,
  OcspResponseStatus,
  parseOcspRequest,
  unsignedOcspResponse,
} from "../../pki/ocsp";
import { PrismaService } from "../../store/PrismaService";

/** How long the CAs' CertID hashes are kept before they are read again. */
const INDEX_MS = 60_000;

/** ...or, when a request names a CA they lack, once they are this old. */
const INDEX_MISS_MS = 5_000;

/** How long before its nextUpdate a cached response is fetched again. */
const MARGIN_SECONDS = 3600;

export type OcspAnswerResult =
  "good" | "revoked" | "unauthorized" | "malformed" | "tryLater";

/** A response to send: the bytes, what they say, and how long to cache them. */
export type OcspAnswer = {
  result: OcspAnswerResult;
  body: Buffer;
  /** For a signed response: its thisUpdate and nextUpdate. */
  thisUpdate?: Date;
  nextUpdate?: Date;
  /** An ETag: the response's SHA-1, as RFC 5019 suggests. */
  etag?: string;
  /** Seconds a cache may keep it. */
  maxAge: number;
};

const indexKey = (hash: CertIdHash, nameHash: Buffer, keyHash: Buffer) =>
  `${hash}:${nameHash.toString("hex")}:${keyHash.toString("hex")}`;

/**
 * The responder's answers (ADR 0036; RFC 6960 and the RFC 5019 profile):
 * the stored, pre-signed response for the one certificate asked about,
 * found by its CA's CertID hashes and its serial. What it does not know is
 * `unauthorized`, never `good`; a response that has lapsed (the signer
 * sealed too long) is `tryLater`. Nothing here signs.
 */
@Injectable()
export class OcspAnswerService {
  private index?: { builtAt: number; issuers: Map<string, string> };

  constructor(private readonly prisma: PrismaService) {}

  async answer(der: Buffer, now = new Date()): Promise<OcspAnswer> {
    let question;
    try {
      question = parseOcspRequest(der);
    } catch {
      return this.status("malformed", OcspResponseStatus.malformedRequest);
    }
    if (question.hash !== "sha1" && question.hash !== "sha256") {
      return this.status("unauthorized", OcspResponseStatus.unauthorized);
    }
    const key = indexKey(
      question.hash,
      question.issuerNameHash,
      question.issuerKeyHash,
    );
    let issuerId = (await this.issuers(now, INDEX_MS)).get(key);
    // A CA whose first responder is newer than the index.
    issuerId ??= (await this.issuers(now, INDEX_MISS_MS)).get(key);
    if (!issuerId) {
      return this.status("unauthorized", OcspResponseStatus.unauthorized);
    }
    const stored = await this.prisma.ocspResponse.findUnique({
      where: {
        issuerId_serial_hash: {
          issuerId,
          serial: question.serial,
          hash: question.hash,
        },
      },
    });
    if (!stored) {
      return this.status("unauthorized", OcspResponseStatus.unauthorized);
    }
    if (stored.nextUpdate <= now) {
      return this.status("tryLater", OcspResponseStatus.tryLater);
    }
    const body = Buffer.from(stored.der);
    const secondsLeft = Math.floor(
      (stored.nextUpdate.getTime() - now.getTime()) / 1000,
    );
    return {
      result: stored.status,
      body,
      thisUpdate: stored.thisUpdate,
      nextUpdate: stored.nextUpdate,
      etag: `"${createHash("sha1").update(body).digest("hex")}"`,
      maxAge: Math.max(0, secondsLeft - MARGIN_SECONDS),
    };
  }

  private status(
    result: OcspAnswerResult,
    status: (typeof OcspResponseStatus)[keyof typeof OcspResponseStatus],
  ): OcspAnswer {
    return { result, body: unsignedOcspResponse(status), maxAge: 0 };
  }

  /** Every CA with a responder, by its CertID hashes, at most `maxAge` old. */
  private async issuers(
    now: Date,
    maxAge: number,
  ): Promise<Map<string, string>> {
    if (this.index && now.getTime() - this.index.builtAt < maxAge) {
      return this.index.issuers;
    }
    const rows = await this.prisma.issuer.findMany({
      where: { certificate: { not: null }, ocspResponders: { some: {} } },
      select: { id: true, certificate: true },
    });
    const issuers = new Map<string, string>();
    for (const row of rows) {
      for (const hash of ["sha1", "sha256"] as const) {
        const { issuerNameHash, issuerKeyHash } = certIdHashes(
          row.certificate!,
          hash,
        );
        issuers.set(indexKey(hash, issuerNameHash, issuerKeyHash), row.id);
      }
    }
    this.index = { builtAt: now.getTime(), issuers };
    return issuers;
  }
}

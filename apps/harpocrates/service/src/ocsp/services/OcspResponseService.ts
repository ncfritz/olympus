import { Inject, Injectable } from "@nestjs/common";
import moment from "moment";
import { ocspConfig, type OcspConfigType } from "../../config/configuration";
import { startNow } from "../../issuers/services/IssuerService";
import { bytes } from "../../pki/x509";
import type { OcspResponsesSummary } from "../../model/ocsp";
import {
  SignerService,
  type OcspResponsesRequest,
} from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import type {
  OcspCertIdHash,
  OcspCertStatus,
  OcspResponse as OcspResponseRow,
  RevocationReason,
} from "../../store/prisma";
import { OcspResponderService } from "./OcspResponderService";

const HOUR = 60 * 60 * 1000;

/** Each certificate is answered for both CertID hashes clients use. */
const HASHES: OcspCertIdHash[] = ["sha1", "sha256"];

/** The most the signer signs in one call. */
const BATCH = 1000;

/** What a certificate's response should say now. */
type Wanted = {
  serial: string;
  status: OcspCertStatus;
  revokedAt?: Date;
  reason?: RevocationReason;
};

export type OcspRefresh = {
  issuerId: string;
  signed: number;
};

const key = (serial: string, hash: OcspCertIdHash) => `${serial}/${hash}`;

/**
 * Every CA's OCSP responses, signed ahead (ADR 0036): one per unexpired
 * certificate it issued (leaves and CAs) and per CertID hash, good or
 * revoked, valid OCSP_VALIDITY_HOURS, re-signed every OCSP_REFRESH_HOURS,
 * at once when a status changes, and by a new responder when one takes
 * over. Stored responses are served while the signer is sealed, until
 * they lapse.
 */
@Injectable()
export class OcspResponseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly responders: OcspResponderService,
    @Inject(ocspConfig.KEY) private readonly config: OcspConfigType,
  ) {}

  /** The CAs with a responder that can sign now. */
  async issuersWithResponders(now = new Date()): Promise<string[]> {
    const rows = await this.prisma.ocspResponder.findMany({
      where: {
        status: "active",
        notBefore: { lte: now },
        notAfter: { gt: now },
        key: { destroyedAt: null },
      },
      select: { issuerId: true },
      distinct: ["issuerId"],
      orderBy: { issuerId: "asc" },
    });
    return rows.map((r) => r.issuerId);
  }

  /**
   * Signs what a CA needs signed: responses missing, saying another
   * status, signed by another responder, a refresh interval old, or within
   * an hour of lapsing. Drops
   * those for certificates no longer current once they have lapsed.
   */
  async refresh(issuerId: string, now = new Date()): Promise<OcspRefresh> {
    const responder = await this.responders.active(issuerId, now);
    if (!responder?.key.signerKeyId) return { issuerId, signed: 0 };
    const wanted = await this.wanted(issuerId, now);
    const stored = new Map(
      (
        await this.prisma.ocspResponse.findMany({
          where: { issuerId },
          select: {
            serial: true,
            hash: true,
            status: true,
            responderId: true,
            thisUpdate: true,
            nextUpdate: true,
          },
        })
      ).map((r) => [key(r.serial, r.hash), r]),
    );
    const stale = new Date(now.getTime() - this.config.refreshHours * HOUR);
    // However recently signed, one this close to lapsing (its responder's
    // end came first) is signed again.
    const lapsing = new Date(now.getTime() + HOUR);
    const due = wanted.flatMap((w) =>
      HASHES.flatMap((hash) => {
        const row = stored.get(key(w.serial, hash));
        const fresh =
          row &&
          row.status === w.status &&
          row.responderId === responder.id &&
          row.thisUpdate > stale &&
          // ...unless it already lasts as long as its responder does.
          (row.nextUpdate > lapsing || row.nextUpdate >= responder.notAfter);
        return fresh ? [] : [{ ...w, hash }];
      }),
    );

    let signed = 0;
    for (let start = 0; start < due.length; start += BATCH) {
      const batch = due.slice(start, start + BATCH);
      // Backdated a little for clocks behind, but never before a
      // revocation it reports.
      const thisUpdate = new Date(
        Math.max(
          startNow().getTime(),
          ...batch.map((e) => e.revokedAt?.getTime() ?? 0),
        ),
      );
      const nextUpdate = new Date(
        Math.min(
          thisUpdate.getTime() + this.config.validityHours * HOUR,
          responder.notAfter.getTime(),
        ),
      );
      const request: OcspResponsesRequest = {
        thisUpdate: thisUpdate.toISOString(),
        nextUpdate: nextUpdate.toISOString(),
        entries: batch.map((e) => ({
          serial: e.serial,
          hash: e.hash,
          status: e.status,
          revokedAt: e.revokedAt?.toISOString(),
          reason: e.reason,
        })),
      };
      const responses = await this.signer.signOcspResponses(
        responder.key.signerKeyId,
        request,
      );
      await this.prisma.$transaction(
        batch.map((e, i) => {
          const data = {
            status: e.status,
            revokedAt: e.revokedAt ?? null,
            reason: e.reason ?? null,
            responderId: responder.id,
            der: bytes(responses[i]),
            thisUpdate,
            nextUpdate,
          };
          return this.prisma.ocspResponse.upsert({
            where: {
              issuerId_serial_hash: {
                issuerId,
                serial: e.serial,
                hash: e.hash,
              },
            },
            create: { issuerId, serial: e.serial, hash: e.hash, ...data },
            update: data,
          });
        }),
      );
      signed += batch.length;
    }

    // A certificate no longer current keeps its response until it lapses.
    const current = new Set(wanted.map((w) => w.serial));
    const lapsed = await this.prisma.ocspResponse.findMany({
      where: { issuerId, nextUpdate: { lte: now } },
      select: { id: true, serial: true },
    });
    const gone = lapsed.filter((r) => !current.has(r.serial)).map((r) => r.id);
    if (gone.length) {
      await this.prisma.ocspResponse.deleteMany({
        where: { id: { in: gone } },
      });
    }
    return { issuerId, signed };
  }

  /** A stored response for a CA's serial, while it has not lapsed. */
  async find(
    issuerId: string,
    serial: string,
    hash: OcspCertIdHash,
    now = new Date(),
  ): Promise<OcspResponseRow | null> {
    return this.prisma.ocspResponse.findFirst({
      where: { issuerId, serial, hash, nextUpdate: { gt: now } },
    });
  }

  async summary(issuerId: string): Promise<OcspResponsesSummary> {
    const [count, revoked, bounds] = await Promise.all([
      this.prisma.ocspResponse.count({ where: { issuerId } }),
      this.prisma.ocspResponse.count({
        where: { issuerId, status: "revoked" },
      }),
      this.prisma.ocspResponse.aggregate({
        where: { issuerId },
        _min: { nextUpdate: true },
        _max: { thisUpdate: true },
      }),
    ]);
    return {
      count,
      revoked,
      earliestNextUpdate: bounds._min.nextUpdate
        ? moment(bounds._min.nextUpdate)
        : undefined,
      latestThisUpdate: bounds._max.thisUpdate
        ? moment(bounds._max.thisUpdate)
        : undefined,
    };
  }

  /**
   * Every certificate a CA issued that has not expired: its leaves, the
   * CAs below it, and serials revoked by lists imported for it. A serial
   * Harpocrates does not know is never answered good.
   */
  private async wanted(issuerId: string, now: Date): Promise<Wanted[]> {
    const [leaves, children, imported] = await Promise.all([
      this.prisma.certificate.findMany({
        where: { issuerId, notAfter: { gt: now } },
        select: { serial: true, status: true, revocation: true },
      }),
      this.prisma.issuer.findMany({
        where: {
          parentId: issuerId,
          serial: { not: null },
          notAfter: { gt: now },
          discardedAt: null,
        },
        select: { serial: true },
      }),
      this.prisma.importedRevocation.findMany({ where: { issuerId } }),
    ]);
    const wanted = new Map<string, Wanted>();
    for (const child of children) {
      wanted.set(child.serial!, { serial: child.serial!, status: "good" });
    }
    for (const leaf of leaves) {
      wanted.set(
        leaf.serial,
        leaf.status === "revoked" && leaf.revocation
          ? {
              serial: leaf.serial,
              status: "revoked",
              revokedAt: leaf.revocation.revokedAt,
              reason: leaf.revocation.reason,
            }
          : { serial: leaf.serial, status: "good" },
      );
    }
    for (const row of imported) {
      wanted.set(row.serial, {
        serial: row.serial,
        status: "revoked",
        revokedAt: row.revokedAt,
        reason: row.reason,
      });
    }
    return [...wanted.values()].sort((a, b) =>
      a.serial.localeCompare(b.serial),
    );
  }
}

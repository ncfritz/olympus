import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  Crl as CrlRow,
  CrlSource,
  Issuer as IssuerRow,
} from "@prisma/client";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { SYSTEM, type Principal } from "../../auth/principal";
import { crlConfig, type CrlConfigType } from "../../config/configuration";
import { startNow } from "../../issuers/services/IssuerService";
import { crlsSigned } from "../../metrics/pkiMetrics";
import type { RevocationList } from "../../model/crls";
import { crlSignedBy, parseCrl, type ParsedCrl } from "../../pki/crl";
import { certificatePem } from "../../pki/x509";
import {
  SignerService,
  type SignerRevocationReason,
} from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import { CRL_URL, toDomainObject } from "../converters/CrlConverter";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type RevokedEntry = {
  serial: string;
  revokedAt: string;
  reason: SignerRevocationReason;
};

const earliest = (a: Date, b: Date | null) => (b && b < a ? b : a);

/**
 * Revocation lists (ADR 0020, Serials, revocation and publication): an
 * online CA's signed by the signer, daily and whenever one is asked for;
 * an offline CA's signed in a ceremony; and lists signed elsewhere,
 * imported once their signature checks. Numbers only go up.
 */
@Injectable()
export class CrlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly audit: AuditService,
    @Inject(crlConfig.KEY) private readonly config: CrlConfigType,
  ) {}

  async list(issuerId: string): Promise<RevocationList[]> {
    await this.issuer(issuerId);
    const rows = await this.prisma.crl.findMany({
      where: { issuerId },
      orderBy: { number: "desc" },
      take: 100,
      include: CRL_URL,
    });
    return rows.map(toDomainObject);
  }

  /**
   * The online CAs whose list is due: one was asked for (a revocation, an
   * imported list), they have none, or theirs is a refresh interval old.
   */
  async due(now = new Date()): Promise<IssuerRow[]> {
    const issuers = await this.prisma.issuer.findMany({
      where: {
        tier: "issuing",
        status: { in: ["active", "closed"] },
        notAfter: { gt: now },
        key: { location: "signer", destroyedAt: null },
      },
      include: { crls: { orderBy: { number: "desc" }, take: 1 } },
      orderBy: { id: "asc" },
    });
    const stale = new Date(now.getTime() - this.config.refreshHours * HOUR);
    return issuers
      .filter((issuer) => {
        const latest = issuer.crls[0];
        return (
          issuer.certificate !== null &&
          (issuer.crlDueAt !== null || !latest || latest.thisUpdate <= stale)
        );
      })
      .map(({ crls: _crls, ...issuer }) => issuer);
  }

  /** A new list for an online CA, from the signer. */
  async signOnline(issuer: IssuerRow): Promise<RevocationList> {
    const started = new Date();
    const thisUpdate = startNow();
    const nextUpdate = earliest(
      new Date(thisUpdate.getTime() + this.config.validityHours * HOUR),
      issuer.notAfter,
    );
    const pem = await this.signer.signCrl(issuer.id, {
      number: Number(issuer.nextCrlNumber),
      thisUpdate: thisUpdate.toISOString(),
      nextUpdate: nextUpdate.toISOString(),
      revoked: await this.revokedUnder(issuer.id, thisUpdate),
    });
    return this.record(SYSTEM, issuer, parseCrl(pem), "signed", { started });
  }

  /** An offline CA's list, signed by its key in an open ceremony. */
  async signInCeremony(
    principal: Principal,
    ceremonyId: string,
  ): Promise<RevocationList> {
    const ceremony = await this.prisma.ceremony.findUnique({
      where: { id: ceremonyId },
      include: { issuer: true },
    });
    if (!ceremony) {
      throw new NotFoundException(`Ceremony with id ${ceremonyId} not found`);
    }
    if (ceremony.closedAt) {
      throw new ConflictException("The ceremony is closed");
    }
    const issuer = ceremony.issuer;
    const thisUpdate = startNow();
    const nextUpdate = earliest(
      new Date(thisUpdate.getTime() + this.config.offlineValidityDays * DAY),
      issuer.notAfter,
    );
    const pem = await this.signer.signCrlInCeremony(ceremonyId, {
      number: Number(issuer.nextCrlNumber),
      thisUpdate: thisUpdate.toISOString(),
      nextUpdate: nextUpdate.toISOString(),
      revoked: await this.revokedUnder(issuer.id, thisUpdate),
    });
    return this.record(principal, issuer, parseCrl(pem), "ceremony", {
      ceremonyId,
    });
  }

  /**
   * A list signed elsewhere (XCA's last, or an offline CA's from its own
   * ceremony): refused unless the CA's certificate verifies it and its
   * number is above every one the CA has. Its serials are carried into the
   * CA's later lists; an online CA signs a fresh one straight after.
   */
  async import(
    principal: Principal,
    issuerId: string,
    pem: string,
  ): Promise<RevocationList> {
    const issuer = await this.issuer(issuerId);
    if (!issuer.certificate) {
      throw new UnprocessableEntityException("The CA has no certificate yet");
    }
    let parsed: ParsedCrl;
    try {
      parsed = parseCrl(pem);
    } catch {
      throw new BadRequestException("The list is not a PEM revocation list");
    }
    if (parsed.issuer !== issuer.subject) {
      throw new UnprocessableEntityException(
        `The list is ${parsed.issuer}'s, not ${issuer.subject}'s`,
      );
    }
    if (!(await crlSignedBy(parsed.der, certificatePem(issuer.certificate)))) {
      throw new UnprocessableEntityException(
        "The list's signature does not verify against the CA's certificate",
      );
    }
    if (parsed.number === undefined) {
      throw new UnprocessableEntityException("The list has no CRL number");
    }
    if (!parsed.nextUpdate || parsed.nextUpdate <= new Date()) {
      throw new UnprocessableEntityException("The list has lapsed");
    }
    return this.record(principal, issuer, parsed, "imported", {});
  }

  /**
   * What an issuer's list carries: its certificates revoked and not yet
   * expired, and the revocations only an imported list told it of.
   */
  private async revokedUnder(
    issuerId: string,
    at: Date,
  ): Promise<RevokedEntry[]> {
    const [certificates, imported] = await Promise.all([
      this.prisma.certificate.findMany({
        where: { issuerId, status: "revoked", notAfter: { gt: at } },
        select: { serial: true, revocation: true },
      }),
      this.prisma.importedRevocation.findMany({ where: { issuerId } }),
    ]);
    const entries = new Map<string, RevokedEntry>();
    for (const row of imported) {
      entries.set(row.serial, {
        serial: row.serial,
        revokedAt: row.revokedAt.toISOString(),
        reason: row.reason,
      });
    }
    for (const row of certificates) {
      if (!row.revocation) continue;
      entries.set(row.serial, {
        serial: row.serial,
        revokedAt: row.revocation.revokedAt.toISOString(),
        reason: row.revocation.reason,
      });
    }
    return [...entries.values()].sort((a, b) =>
      a.serial.localeCompare(b.serial),
    );
  }

  private async record(
    principal: Principal,
    issuer: IssuerRow,
    parsed: ParsedCrl,
    source: CrlSource,
    options: { started?: Date; ceremonyId?: string },
  ): Promise<RevocationList> {
    const number = parsed.number;
    if (number === undefined || !parsed.nextUpdate) {
      throw new UnprocessableEntityException(
        "The list has no number or no next update",
      );
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.crl.findFirst({
        where: { issuerId: issuer.id },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const claimed = await tx.issuer.updateMany({
        where: { id: issuer.id, nextCrlNumber: { lte: number } },
        data: { nextCrlNumber: number + 1n },
      });
      if (claimed.count === 0 || (latest && latest.number >= number)) {
        throw new ConflictException(
          `The CA already has list ${latest?.number ?? issuer.nextCrlNumber - 1n}: a list's number must be higher`,
        );
      }
      // A revocation during this signing asks again; one before is served.
      if (source === "imported" && issuer.tier === "issuing") {
        await tx.issuer.update({
          where: { id: issuer.id },
          data: { crlDueAt: new Date() },
        });
      } else if (options.started) {
        await tx.issuer.updateMany({
          where: { id: issuer.id, crlDueAt: { lte: options.started } },
          data: { crlDueAt: null },
        });
      }
      if (source === "imported") {
        await this.carry(tx, principal, issuer.id, parsed, number);
      }
      const created: CrlRow = await tx.crl.create({
        data: {
          issuerId: issuer.id,
          number,
          source,
          ceremonyId: options.ceremonyId,
          thisUpdate: parsed.thisUpdate,
          nextUpdate: parsed.nextUpdate!,
          entries: parsed.entries.length,
          der: parsed.der,
        },
      });
      await this.audit.record(
        {
          kind:
            source === "imported" ? AuditKind.CrlImported : AuditKind.CrlSigned,
          principal,
          subjectType: "issuer",
          subjectId: issuer.id,
          attributes: {
            number: number.toString(),
            source,
            entries: parsed.entries.length,
            nextUpdate: parsed.nextUpdate!.toISOString(),
            ceremonyId: options.ceremonyId,
          },
        },
        tx,
      );
      return created;
    });
    crlsSigned.inc({ issuer: issuer.id, source });
    return toDomainObject({ ...row, issuer: { crlUrl: issuer.crlUrl } });
  }

  /**
   * An imported list's serials: a certificate here that it names is
   * revoked, with the list's date and reason (XCA's revocations, at the
   * cutover); one it names that is not here is kept as an imported
   * revocation, so the CA's later lists carry it.
   */
  private async carry(
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
    principal: Principal,
    issuerId: string,
    parsed: ParsedCrl,
    number: bigint,
  ): Promise<void> {
    const certificates = new Map(
      (
        await tx.certificate.findMany({
          where: {
            issuerId,
            serial: { in: parsed.entries.map((e) => e.serial) },
          },
          include: { enrollment: { select: { key: true } } },
        })
      ).map((c) => [c.serial, c]),
    );
    for (const entry of parsed.entries) {
      const certificate = certificates.get(entry.serial);
      if (!certificate) {
        await tx.importedRevocation.upsert({
          where: { issuerId_serial: { issuerId, serial: entry.serial } },
          create: {
            issuerId,
            serial: entry.serial,
            revokedAt: entry.revokedAt,
            reason: entry.reason,
            crlNumber: number,
          },
          update: {},
        });
        continue;
      }
      if (certificate.status === "revoked") continue;
      await tx.revocation.create({
        data: {
          certificateId: certificate.id,
          reason: entry.reason,
          comment: `Listed in ${issuerId}'s imported list ${number}`,
          principal: principal.id,
          revokedAt: entry.revokedAt,
        },
      });
      await tx.certificate.update({
        where: { id: certificate.id },
        data: { status: "revoked" },
      });
      await this.audit.record(
        {
          kind: AuditKind.CertificateRevoked,
          principal,
          subjectType: "certificate",
          subjectId: certificate.id,
          reason: `Listed in ${issuerId}'s imported list ${number}`,
          attributes: {
            issuerId,
            serial: certificate.serial,
            reason: entry.reason,
            revokedAt: entry.revokedAt.toISOString(),
          },
        },
        tx,
      );
      const key = certificate.enrollment?.key;
      if (entry.reason === "keyCompromise" && key && !key.blockedAt) {
        await tx.key.update({
          where: { id: key.id },
          data: { blockedAt: new Date() },
        });
        await this.audit.record(
          {
            kind: AuditKind.KeyBlocked,
            principal,
            subjectType: "key",
            subjectId: key.id,
            attributes: { spkiSha256: key.spkiSha256 },
          },
          tx,
        );
      }
    }
  }

  private async issuer(issuerId: string): Promise<IssuerRow> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: issuerId },
    });
    if (!issuer) {
      throw new NotFoundException(`Issuer with id ${issuerId} not found`);
    }
    return issuer;
  }
}

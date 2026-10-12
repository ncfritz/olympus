import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { SYSTEM, type Principal } from "../../auth/principal";
import {
  crlConfig,
  type CrlConfigType,
  ocspConfig,
  type OcspConfigType,
} from "../../config/configuration";
import { startNow } from "../../issuers/services/IssuerService";
import { KeyService } from "../../keys/services/KeyService";
import type { OcspResponder } from "../../model/ocsp";
import { parseCertificate, randomSerial } from "../../pki/x509";
import {
  SignerService,
  type ResponderSpec,
  type SignerOcspResponder,
} from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import type {
  Issuer as IssuerRow,
  OcspResponder as OcspResponderRow,
} from "../../store/prisma";
import { toOcspResponder } from "../converters/OcspConverter";

const DAY = 24 * 60 * 60 * 1000;

/** A responder's subject: its CA's, the CN marked as the CA's OCSP. */
export const responderSubject = (issuer: Pick<IssuerRow, "id" | "subject">) =>
  /^CN=/.test(issuer.subject)
    ? issuer.subject.replace(/^CN=((?:\\,|[^,])*)/, "CN=$1 OCSP")
    : `CN=${issuer.id} OCSP,${issuer.subject}`;

const earliest = (a: Date, b: Date | null) => (b && b < a ? b : a);

/**
 * Each CA's OCSP responder (ADR 0036). An online issuing CA's is issued
 * and renewed by the service, with no one present: valid
 * OCSP_RESPONDER_DAYS, replaced with a new key OCSP_RESPONDER_RENEW_DAYS
 * before it lapses. An offline CA's is issued in its ceremony, valid as
 * long as its list (CRL_OFFLINE_VALIDITY_DAYS). A superseded responder's
 * key is destroyed in the signer once it has expired.
 */
@Injectable()
export class OcspResponderService {
  private readonly logger = new Logger(OcspResponderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly keys: KeyService,
    private readonly audit: AuditService,
    @Inject(ocspConfig.KEY) private readonly config: OcspConfigType,
    @Inject(crlConfig.KEY) private readonly crl: CrlConfigType,
  ) {}

  async list(issuerId: string): Promise<OcspResponder[]> {
    if (!(await this.prisma.issuer.findUnique({ where: { id: issuerId } }))) {
      throw new NotFoundException(`Issuer with id ${issuerId} not found`);
    }
    const rows = await this.prisma.ocspResponder.findMany({
      where: { issuerId },
      // Certificates' times are whole seconds: two within one tie.
      orderBy: [{ notBefore: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toOcspResponder);
  }

  /** The responder that signs a CA's responses now, if it has one. */
  active(issuerId: string, now = new Date()) {
    return this.prisma.ocspResponder.findFirst({
      where: {
        issuerId,
        status: "active",
        notBefore: { lte: now },
        notAfter: { gt: now },
        key: { destroyedAt: null },
      },
      orderBy: { notAfter: "desc" },
      include: { key: true },
    });
  }

  /** The online CAs whose responder is missing or within its renewal. */
  async due(now = new Date()): Promise<IssuerRow[]> {
    const renewBy = new Date(
      now.getTime() + this.config.responderRenewDays * DAY,
    );
    return this.prisma.issuer.findMany({
      where: {
        tier: "issuing",
        status: { in: ["active", "closed"] },
        notAfter: { gt: renewBy },
        certificate: { not: null },
        key: { location: "signer", destroyedAt: null },
        ocspResponders: {
          none: { status: "active", notAfter: { gt: renewBy } },
        },
      },
      orderBy: { id: "asc" },
    });
  }

  /** An online CA's responder, signed by its own key in the signer. */
  async issueOnline(issuer: IssuerRow): Promise<OcspResponder> {
    const notBefore = startNow();
    const notAfter = earliest(
      new Date(notBefore.getTime() + this.config.responderDays * DAY),
      issuer.notAfter,
    );
    return this.issue(SYSTEM, issuer, notBefore, notAfter, (spec) =>
      this.signer.issueOcspResponder(issuer.id, spec),
    );
  }

  /** An offline CA's responder, signed by its key in an open ceremony. */
  async issueInCeremony(
    principal: Principal,
    ceremonyId: string,
  ): Promise<OcspResponder> {
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
    const notBefore = startNow();
    const notAfter = earliest(
      new Date(notBefore.getTime() + this.crl.offlineValidityDays * DAY),
      ceremony.issuer.notAfter,
    );
    return this.issue(
      principal,
      ceremony.issuer,
      notBefore,
      notAfter,
      (spec) => this.signer.issueOcspResponderInCeremony(ceremonyId, spec),
      ceremonyId,
    );
  }

  /**
   * Destroys the keys of superseded responders that have expired: nothing
   * they signed is served any more.
   */
  async retireExpired(now = new Date()): Promise<string[]> {
    const rows = await this.prisma.ocspResponder.findMany({
      where: {
        status: "superseded",
        notAfter: { lte: now },
        key: { destroyedAt: null },
      },
      include: { key: true },
    });
    const retired: string[] = [];
    for (const row of rows) {
      if (row.key.signerKeyId)
        await this.signer.destroyKey(row.key.signerKeyId);
      await this.prisma.$transaction(async (tx) => {
        await tx.key.update({
          where: { id: row.keyId },
          data: { destroyedAt: now },
        });
        await this.audit.record(
          {
            kind: AuditKind.OcspResponderRetired,
            principal: SYSTEM,
            subjectType: "ocsp-responder",
            subjectId: row.id,
            attributes: { issuerId: row.issuerId, serial: row.serial },
          },
          tx,
        );
      });
      retired.push(row.id);
    }
    return retired;
  }

  /**
   * A new key in the signer, its certificate from `sign`, and the CA's
   * other active responders superseded by it, in one transaction.
   */
  private async issue(
    principal: Principal,
    issuer: IssuerRow,
    notBefore: Date,
    notAfter: Date,
    sign: (spec: ResponderSpec) => Promise<SignerOcspResponder>,
    ceremonyId?: string,
  ): Promise<OcspResponder> {
    if (
      !issuer.certificate ||
      !issuer.notAfter ||
      issuer.notAfter <= notBefore
    ) {
      throw new UnprocessableEntityException(
        `${issuer.id} has no current certificate to issue a responder under`,
      );
    }
    const signerKey = await this.signer.generateKey("ocsp", "P-256");
    let issued: SignerOcspResponder;
    try {
      issued = await sign({
        subject: responderSubject(issuer),
        serial: randomSerial(),
        notBefore: notBefore.toISOString(),
        notAfter: notAfter.toISOString(),
        keyId: signerKey.id,
      });
    } catch (error: unknown) {
      // The key certifies nothing: it goes.
      await this.signer.destroyKey(signerKey.id).catch((cleanup: unknown) => {
        this.logger.warn(
          `An unused OCSP key ${signerKey.id} stays in the signer: ${String(cleanup)}`,
        );
      });
      throw error;
    }
    const parsed = parseCertificate(issued.certificate);
    const row: OcspResponderRow = await this.prisma.$transaction(async (tx) => {
      const key = await this.keys.record(tx, {
        spki: parsed.spki,
        purpose: "ocsp",
        location: "signer",
        signerKeyId: signerKey.id,
      });
      await tx.ocspResponder.updateMany({
        where: { issuerId: issuer.id, status: "active" },
        data: { status: "superseded" },
      });
      const created = await tx.ocspResponder.create({
        data: {
          issuerId: issuer.id,
          keyId: key.id,
          serial: parsed.serial,
          subject: parsed.subject,
          certificate: parsed.der,
          notBefore: parsed.notBefore,
          notAfter: parsed.notAfter,
          ceremonyId,
        },
      });
      await this.audit.record(
        {
          kind: AuditKind.OcspResponderIssued,
          principal,
          subjectType: "ocsp-responder",
          subjectId: created.id,
          attributes: {
            issuerId: issuer.id,
            serial: parsed.serial,
            notAfter: parsed.notAfter.toISOString(),
            ...(ceremonyId ? { ceremonyId } : {}),
          },
        },
        tx,
      );
      return created;
    });
    return toOcspResponder(row);
  }
}

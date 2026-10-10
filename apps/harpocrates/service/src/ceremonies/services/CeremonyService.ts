import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Ceremony as CeremonyRow } from "@prisma/client";
import moment from "moment";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import { constraintRows } from "../../issuers/converters/IssuerConverter";
import type { IssuerNameParts } from "../../issuers/issuerNames";
import { issuerSlug } from "../../issuers/issuerNames";
import {
  addDays,
  childNotAfter,
  describeSigned,
  isIssuingWindowOpen,
  noTimeToSign,
  offlineMaxValidityDays,
  type SignedInCeremony,
  signedInCeremony,
  TIER_PATH_LENGTH,
} from "../../issuers/issuingWindow";
import { overridesGiven, signerConstraints } from "../../issuers/overrides";
import { CrlService } from "../../crls/services/CrlService";
import { IssuerService, startNow } from "../../issuers/services/IssuerService";
import type { Ceremony } from "../../model/ceremonies";
import type {
  CreateIntermediateIssuerRequest,
  CreateIssuingIssuerRequest,
  FullIssuer,
} from "../../model/issuers";
import { certificatePem, randomSerial, spkiFromPem } from "../../pki/x509";
import { SignerService } from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";

const toDomainObject = (row: CeremonyRow): Ceremony => ({
  id: row.id,
  issuerId: row.issuerId,
  principal: row.principal,
  openedAt: moment(row.openedAt),
  closedAt: row.closedAt ? moment(row.closedAt) : undefined,
});

/**
 * A child's notAfter: its tier's lifetime clamped to its parent's by
 * default; one given outright is refused rather than clamped, so the CA
 * is never shorter than the operator asked for without saying so.
 */
const notAfterFor = (
  notBefore: Date,
  tier: "intermediate" | "issuing",
  parentNotAfter: Date,
  validityDays: number | undefined,
): Date => {
  if (validityDays === undefined) {
    return childNotAfter(notBefore, tier, parentNotAfter);
  }
  const wanted = addDays(notBefore, validityDays);
  if (wanted > parentNotAfter) {
    throw new UnprocessableEntityException(
      `${validityDays} days would outlive its parent, which expires ${parentNotAfter.toISOString()}`,
    );
  }
  return wanted;
};

/**
 * Ceremonies (ADR 0020): an offline CA's key in the signer for one
 * sitting, to sign the CAs below it. The signer holds the key and ends
 * the ceremony on its own timeout, a seal or a restart; this records who
 * opened it and what it signed.
 */
@Injectable()
export class CeremonyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly issuers: IssuerService,
    private readonly crls: CrlService,
    private readonly audit: AuditService,
  ) {}

  async open(
    principal: Principal,
    issuerId: string,
    privateKey: string,
    passphrase: string,
  ): Promise<Ceremony> {
    const issuer = await this.issuers.row(issuerId);
    if (issuer.tier === "issuing" || !issuer.certificate) {
      throw new UnprocessableEntityException(
        "Ceremonies are for offline CAs: roots and intermediates",
      );
    }
    if (issuer.discardedAt) {
      throw new UnprocessableEntityException(`${issuerId} was discarded`);
    }
    const opened = await this.signer.openCeremony(
      privateKey,
      passphrase,
      certificatePem(issuer.certificate),
    );
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ceremony.create({
        data: { id: opened.id, issuerId, principal: principal.id },
      });
      await this.audit.record(
        {
          kind: AuditKind.CeremonyOpened,
          principal,
          subjectType: "ceremony",
          subjectId: opened.id,
          attributes: { issuerId, expiresAt: opened.expiresAt },
        },
        tx,
      );
      // The key opened and matches the certificate: the backup works
      // (ADR 0032, a new root).
      if (!issuer.provedAt) {
        await tx.issuer.update({
          where: { id: issuerId },
          data: { provedAt: new Date() },
        });
        await this.audit.record(
          {
            kind: AuditKind.IssuerProved,
            principal,
            subjectType: "issuer",
            subjectId: issuerId,
            attributes: { ceremonyId: opened.id },
          },
          tx,
        );
      }
      return created;
    });
    // Its first list, before anything beneath it is published: the list
    // brings its certificate to the distribution point with it.
    if ((await this.prisma.crl.count({ where: { issuerId } })) === 0) {
      await this.crls.signInCeremony(principal, opened.id);
    }
    return toDomainObject(row);
  }

  async describe(ceremonyId: string): Promise<Ceremony> {
    return toDomainObject(await this.row(ceremonyId));
  }

  async close(principal: Principal, ceremonyId: string): Promise<void> {
    const row = await this.row(ceremonyId);
    if (row.closedAt) return;
    try {
      await this.signer.closeCeremony(ceremonyId);
    } catch (error: unknown) {
      // Already gone in the signer (timed out, sealed, restarted): the key
      // is forgotten either way, which is what closing means.
      if (!(error instanceof NotFoundException)) throw error;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.ceremony.update({
        where: { id: ceremonyId },
        data: { closedAt: new Date() },
      });
      await this.audit.record(
        {
          kind: AuditKind.CeremonyClosed,
          principal,
          subjectType: "ceremony",
          subjectId: ceremonyId,
          attributes: { issuerId: row.issuerId },
        },
        tx,
      );
    });
  }

  /** An offline intermediate below the ceremony's root (three tiers). */
  async createIntermediate(
    principal: Principal,
    ceremonyId: string,
    request: CreateIntermediateIssuerRequest,
  ): Promise<{ issuer: FullIssuer; encryptedKey: string }> {
    const parent = await this.openParent(ceremonyId, "intermediate");
    const parts: IssuerNameParts = {
      tier: "intermediate",
      purpose: request.purpose,
      number: request.number,
      generation: request.generation,
    };
    const id = issuerSlug(parts);
    if (await this.prisma.issuer.findUnique({ where: { id } })) {
      throw new ConflictException(`Issuer ${id} already exists`);
    }
    const organization =
      request.organization ?? parent.organization ?? undefined;
    const subject = await this.issuers.newSubject(parts, request, organization);
    const notBefore = startNow();
    const notAfter = notAfterFor(
      notBefore,
      "intermediate",
      parent.notAfter!,
      request.validityDays,
    );
    const idle = noTimeToSign(
      notBefore,
      notAfter,
      offlineMaxValidityDays("intermediate"),
    );
    if (idle) throw new UnprocessableEntityException(idle);
    const created = await this.signer.createIntermediate(
      ceremonyId,
      {
        subject,
        serial: randomSerial(),
        notBefore: notBefore.toISOString(),
        notAfter: notAfter.toISOString(),
        keyUsage: ["key_cert_sign", "crl_sign"],
        ca: true,
        pathLength: TIER_PATH_LENGTH.intermediate,
        nameConstraints: signerConstraints(request.nameConstraints),
        crlDistributionPoints: [parent.crlUrl],
        issuerUrls: [parent.caIssuersUrl],
      },
      request.algorithm ?? "P-256",
      request.exportPassphrase,
    );
    const issuer = await this.issuers.recordOffline(principal, {
      id,
      parts,
      certificatePem: created.certificate,
      parentId: parent.id,
      kind: AuditKind.IssuerCreated,
      constraints: constraintRows(request.nameConstraints),
      organization,
      overrides: overridesGiven(request),
    });
    return { issuer, encryptedKey: created.encryptedKey };
  }

  /**
   * An online issuing CA below the ceremony's intermediate, or below a
   * two-tier root: its key is generated in the signer's store, its
   * certificate signed in the ceremony, and it is registered with the
   * signer.
   */
  async createIssuing(
    principal: Principal,
    ceremonyId: string,
    request: CreateIssuingIssuerRequest,
  ): Promise<FullIssuer> {
    const parent = await this.openParent(ceremonyId, "issuing");
    const parts: IssuerNameParts = {
      tier: "issuing",
      purpose: request.purpose,
      number: request.number,
      generation: request.generation,
    };
    const id = issuerSlug(parts);
    if (await this.prisma.issuer.findUnique({ where: { id } })) {
      throw new ConflictException(`Issuer ${id} already exists`);
    }
    const organization =
      request.organization ?? parent.organization ?? undefined;
    const subject = await this.issuers.newSubject(parts, request, organization);
    const notBefore = startNow();
    const notAfter = notAfterFor(
      notBefore,
      "issuing",
      parent.notAfter!,
      request.validityDays,
    );
    const idle = noTimeToSign(notBefore, notAfter, request.maxValidityDays);
    if (idle) throw new UnprocessableEntityException(idle);
    const key = await this.signer.generateKey(
      "issuer",
      request.algorithm ?? "P-256",
    );
    const certificate = await this.signer.signInCeremony(ceremonyId, {
      subject,
      serial: randomSerial(),
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
      keyUsage: ["digital_signature", "key_cert_sign", "crl_sign"],
      extendedKeyUsages: request.extendedKeyUsages,
      keyId: key.id,
      ca: true,
      pathLength: TIER_PATH_LENGTH.issuing,
      nameConstraints: signerConstraints(request.nameConstraints),
      crlDistributionPoints: [parent.crlUrl],
      issuerUrls: [parent.caIssuersUrl],
    });
    await this.issuers.registerIssuing(principal, {
      id,
      parts,
      certificatePem: certificate,
      chain: [
        certificatePem(parent.certificate!),
        ...(await this.issuers.chainPems(parent)),
      ],
      signerKeyId: key.id,
      spki: spkiFromPem(key.publicKey),
      parentId: parent.id,
      maxValidityDays: request.maxValidityDays,
      extendedKeyUsages: request.extendedKeyUsages,
      constraints: constraintRows(request.nameConstraints),
      kind: AuditKind.IssuerCreated,
      organization,
      overrides: overridesGiven(request),
    });
    return this.issuers.describe(id);
  }

  /** The open ceremony's CA, when it is a root that signs directly. */
  async directRoot(ceremonyId: string) {
    return this.openParent(ceremonyId, "leaf");
  }

  private async row(ceremonyId: string): Promise<CeremonyRow> {
    const row = await this.prisma.ceremony.findUnique({
      where: { id: ceremonyId },
    });
    if (!row) {
      throw new NotFoundException(`Ceremony with id ${ceremonyId} not found`);
    }
    return row;
  }

  /**
   * The open ceremony's CA, which must be able to sign `what` (ADR 0032,
   * shapes): an intermediate only under a three-tier root; an issuing CA
   * under an intermediate or a two-tier root; a leaf only under a root that
   * signs directly.
   */
  private async openParent(ceremonyId: string, what: SignedInCeremony) {
    const ceremony = await this.row(ceremonyId);
    if (ceremony.closedAt) {
      throw new ConflictException(`Ceremony ${ceremonyId} is closed`);
    }
    const parent = await this.issuers.row(ceremony.issuerId);
    const signs = signedInCeremony(parent);
    if (signs !== what) {
      throw new UnprocessableEntityException(
        `${parent.id} signs ${describeSigned(signs)}, not ${describeSigned(what)}`,
      );
    }
    if (
      parent.status !== "active" ||
      !isIssuingWindowOpen(parent.notAfter, parent.maxValidityDays)
    ) {
      throw new UnprocessableEntityException(
        `Issuer ${parent.id} no longer signs: create its successor`,
      );
    }
    return parent;
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Issuer as IssuerRow, Prisma, Profile } from "@prisma/client";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import { pkiConfig, type PkiConfigType } from "../../config/configuration";
import { KeyService } from "../../keys/services/KeyService";
import type {
  CreateRootIssuerRequest,
  FullIssuer,
  ImportIssuerRequest,
  Issuer,
} from "../../model/issuers";
import {
  certificatePem,
  isIssuedBy,
  parseCertificate,
  randomSerial,
  spkiFromPem,
  subjectName,
} from "../../pki/x509";
import { SignerService } from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import {
  ISSUER_RULES,
  type IssuerWithRules,
  toDomainObject,
  toFullIssuer,
} from "../converters/IssuerConverter";
import {
  distributionUrls,
  issuerCommonName,
  type IssuerNameParts,
  issuerSlug,
} from "../issuerNames";
import {
  addDays,
  isIssuingWindowOpen,
  OFFLINE_MAX_VALIDITY_DAYS,
  TIER_PATH_LENGTH,
  TIER_VALIDITY_DAYS,
} from "../issuingWindow";

const TIER_ORDER = { root: 0, intermediate: 1, issuing: 2 } as const;

/** A certificate starts a few minutes back, for clocks that run slow. */
export const BACKDATE_MINUTES = 5;

export const startNow = () => new Date(Date.now() - BACKDATE_MINUTES * 60_000);

/** The CAs (ADR 0020, Hierarchy): the tree, their rules and their windows. */
@Injectable()
export class IssuerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly keys: KeyService,
    private readonly audit: AuditService,
    @Inject(pkiConfig.KEY) private readonly pki: PkiConfigType,
  ) {}

  async list(): Promise<Issuer[]> {
    const rows = await this.prisma.issuer.findMany({ include: ISSUER_RULES });
    return rows
      .sort(
        (a, b) =>
          TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.id.localeCompare(b.id),
      )
      .map(toDomainObject);
  }

  async describe(issuerId: string): Promise<FullIssuer> {
    const row = await this.row(issuerId);
    return toFullIssuer(row, await this.chainPems(row));
  }

  async row(
    issuerId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<IssuerWithRules> {
    const row = await tx.issuer.findUnique({
      where: { id: issuerId },
      include: ISSUER_RULES,
    });
    if (!row)
      throw new NotFoundException(`Issuer with id ${issuerId} not found`);
    return row;
  }

  /** The certificates above an issuer, PEM, nearest first. */
  async chainPems(
    issuer: IssuerRow,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const chain: string[] = [];
    let parentId = issuer.parentId;
    while (parentId) {
      const parent = await tx.issuer.findUniqueOrThrow({
        where: { id: parentId },
      });
      if (parent.certificate) chain.push(certificatePem(parent.certificate));
      parentId = parent.parentId;
    }
    return chain;
  }

  nameParts(row: IssuerRow): IssuerNameParts {
    return {
      tier: row.tier,
      purpose: row.purpose ?? undefined,
      number: row.number,
      generation: row.generation,
    };
  }

  subjectFor(parts: IssuerNameParts): string {
    return subjectName({
      commonName: issuerCommonName(this.pki.realm, parts),
      organization: this.pki.organization,
    });
  }

  urlsFor(slug: string) {
    return distributionUrls(this.pki.distributionUrl, slug);
  }

  /** A new root, created as a ceremony: its key leaves encrypted, once. */
  async createRoot(
    principal: Principal,
    request: CreateRootIssuerRequest,
  ): Promise<{ issuer: FullIssuer; encryptedKey: string }> {
    const parts: IssuerNameParts = {
      tier: "root",
      number: request.number,
      generation: request.generation,
    };
    const id = issuerSlug(parts);
    await this.assertNew(id);
    const notBefore = startNow();
    const created = await this.signer.createRoot(
      {
        subject: this.subjectFor(parts),
        serial: randomSerial(),
        notBefore: notBefore.toISOString(),
        notAfter: addDays(notBefore, TIER_VALIDITY_DAYS.root).toISOString(),
        keyUsage: ["key_cert_sign", "crl_sign"],
        ca: true,
        pathLength: TIER_PATH_LENGTH.root,
      },
      request.algorithm ?? "P-256",
      request.exportPassphrase,
    );
    const issuer = await this.recordOffline(principal, {
      id,
      parts,
      certificatePem: created.certificate,
      parentId: null,
      kind: AuditKind.IssuerCreated,
    });
    return { issuer, encryptedKey: created.encryptedKey };
  }

  /**
   * Records an offline CA (a root or an intermediate) from its
   * certificate: its key is offline, so only the public key is kept.
   */
  async recordOffline(
    principal: Principal,
    offline: {
      id: string;
      parts: IssuerNameParts;
      certificatePem: string;
      parentId: string | null;
      kind: typeof AuditKind.IssuerCreated | typeof AuditKind.IssuerImported;
      constraints?: {
        kind: "permitted" | "excluded";
        type: "dns" | "ip" | "email" | "uri";
        value: string;
      }[];
    },
  ): Promise<FullIssuer> {
    const certificate = parseCertificate(offline.certificatePem);
    const tier = offline.parts.tier as "root" | "intermediate";
    await this.prisma.$transaction(async (tx) => {
      const key = await this.keys.record(tx, {
        spki: certificate.spki,
        purpose: "issuer",
        location: "offline",
      });
      await tx.issuer.create({
        data: {
          id: offline.id,
          subject: certificate.subject,
          tier,
          status: "active",
          purpose: offline.parts.purpose,
          number: offline.parts.number,
          generation: offline.parts.generation,
          parentId: offline.parentId,
          keyId: key.id,
          certificate: certificate.der,
          serial: certificate.serial,
          notBefore: certificate.notBefore,
          notAfter: certificate.notAfter,
          pathLength: certificate.pathLength,
          maxValidityDays: OFFLINE_MAX_VALIDITY_DAYS[tier],
          ...this.urlsFor(offline.id),
          nameConstraints: { create: offline.constraints ?? [] },
        },
      });
      await this.audit.record(
        {
          kind: offline.kind,
          principal,
          subjectType: "issuer",
          subjectId: offline.id,
          attributes: {
            tier,
            subject: certificate.subject,
            serial: certificate.serial,
            notAfter: certificate.notAfter.toISOString(),
            keyLocation: "offline",
          },
        },
        tx,
      );
    });
    return this.describe(offline.id);
  }

  /**
   * Imports an existing CA (the cutover from XCA): offline tiers by their
   * certificate alone; an issuing CA with its key, into the signer.
   */
  async import(
    principal: Principal,
    request: ImportIssuerRequest,
  ): Promise<FullIssuer> {
    await this.assertNew(request.id);
    const certificate = parseCertificate(request.certificate);
    if (!certificate.ca) {
      throw new BadRequestException("The certificate is not a CA");
    }
    const parent = await this.parentOf(request.certificate, request.chain);
    const parts: IssuerNameParts = {
      tier: request.tier,
      purpose: request.purpose,
      number: request.number,
      generation: request.generation,
    };
    if (request.tier !== "issuing") {
      if (request.privateKey) {
        throw new BadRequestException(
          "Offline CAs are imported without their key",
        );
      }
      return this.recordOffline(principal, {
        id: request.id,
        parts,
        certificatePem: request.certificate,
        parentId: parent?.id ?? null,
        kind: AuditKind.IssuerImported,
      });
    }
    if (!request.privateKey || !request.passphrase) {
      throw new BadRequestException(
        "An issuing CA is imported with its key and passphrase",
      );
    }
    if (certificate.pathLength !== 0) {
      throw new UnprocessableEntityException("An issuing CA has path length 0");
    }
    const signerKey = await this.signer.importKey(
      "issuer",
      request.privateKey,
      request.passphrase,
    );
    await this.registerIssuing(principal, {
      id: request.id,
      parts,
      certificatePem: request.certificate,
      chain: request.chain,
      signerKeyId: signerKey.id,
      spki: spkiFromPem(signerKey.publicKey),
      parentId: parent?.id ?? null,
      maxValidityDays: request.maxValidityDays,
      extendedKeyUsages: request.extendedKeyUsages,
      constraints: [],
      kind: AuditKind.IssuerImported,
    });
    return this.describe(request.id);
  }

  /** Registers an online issuing CA with the signer and records it. */
  async registerIssuing(
    principal: Principal,
    issuing: {
      id: string;
      parts: IssuerNameParts;
      certificatePem: string;
      chain: string[];
      signerKeyId: string;
      spki: Buffer;
      parentId: string | null;
      maxValidityDays: number;
      extendedKeyUsages: string[];
      constraints: {
        kind: "permitted" | "excluded";
        type: "dns" | "ip" | "email" | "uri";
        value: string;
      }[];
      kind: typeof AuditKind.IssuerCreated | typeof AuditKind.IssuerImported;
    },
  ): Promise<void> {
    const certificate = parseCertificate(issuing.certificatePem);
    await this.signer.registerIssuer({
      id: issuing.id,
      keyId: issuing.signerKeyId,
      certificate: issuing.certificatePem,
      chain: issuing.chain,
      maxValidityDays: issuing.maxValidityDays,
      extendedKeyUsages: issuing.extendedKeyUsages,
    });
    await this.prisma.$transaction(async (tx) => {
      const key = await this.keys.record(tx, {
        spki: issuing.spki,
        purpose: "issuer",
        location: "signer",
        signerKeyId: issuing.signerKeyId,
      });
      await tx.issuer.create({
        data: {
          id: issuing.id,
          subject: certificate.subject,
          tier: "issuing",
          status: "active",
          purpose: issuing.parts.purpose,
          number: issuing.parts.number,
          generation: issuing.parts.generation,
          parentId: issuing.parentId,
          keyId: key.id,
          certificate: certificate.der,
          serial: certificate.serial,
          notBefore: certificate.notBefore,
          notAfter: certificate.notAfter,
          pathLength: 0,
          maxValidityDays: issuing.maxValidityDays,
          ...this.urlsFor(issuing.id),
          extendedKeyUsages: {
            create: issuing.extendedKeyUsages.map((oid) => ({ oid })),
          },
          nameConstraints: { create: issuing.constraints },
        },
      });
      await this.audit.record(
        {
          kind: issuing.kind,
          principal,
          subjectType: "issuer",
          subjectId: issuing.id,
          attributes: {
            tier: "issuing",
            subject: certificate.subject,
            serial: certificate.serial,
            notAfter: certificate.notAfter.toISOString(),
            keyLocation: "signer",
            maxValidityDays: issuing.maxValidityDays,
          },
        },
        tx,
      );
    });
  }

  /**
   * The issuer a profile's certificate comes from: the override if given
   * (and able to sign it), else the pinned one, else the active issuing CA
   * of the profile's purpose; a CA past its window hands over to its
   * successor (ADR 0020, Longevity).
   */
  async forIssuance(
    profile: Profile,
    override?: string,
  ): Promise<IssuerWithRules> {
    if (override) {
      const chosen = await this.row(override);
      this.assertCanIssue(chosen, profile);
      return chosen;
    }
    const candidates = (
      await this.prisma.issuer.findMany({
        where: {
          tier: "issuing",
          status: "active",
          purpose: profile.issuerPurpose,
        },
        include: ISSUER_RULES,
        orderBy: [{ number: "asc" }, { generation: "desc" }],
      })
    ).filter(
      (row) =>
        isIssuingWindowOpen(row.notAfter, row.maxValidityDays) &&
        this.allowsUsages(row, profile),
    );
    const pinned = profile.issuerId
      ? candidates.find((row) => row.id === profile.issuerId)
      : undefined;
    const pinnedRow = profile.issuerId
      ? await this.prisma.issuer.findUnique({ where: { id: profile.issuerId } })
      : undefined;
    const successor = pinnedRow
      ? candidates.find(
          (row) =>
            row.number === pinnedRow.number &&
            row.generation > pinnedRow.generation,
        )
      : undefined;
    const chosen = pinned ?? successor ?? candidates[0];
    if (!chosen) {
      throw new UnprocessableEntityException(
        `No active issuing CA for ${profile.issuerPurpose} can sign ${profile.id} certificates`,
      );
    }
    return chosen;
  }

  private allowsUsages(
    row: IssuerWithRules,
    profile: Profile & { extendedKeyUsages?: { oid: string }[] },
  ): boolean {
    const allowed = new Set(row.extendedKeyUsages.map((u) => u.oid));
    return (profile.extendedKeyUsages ?? []).every((u) => allowed.has(u.oid));
  }

  private assertCanIssue(row: IssuerWithRules, profile: Profile): void {
    if (row.tier !== "issuing" || row.status !== "active") {
      throw new UnprocessableEntityException(
        `Issuer ${row.id} is not an active issuing CA`,
      );
    }
    if (!isIssuingWindowOpen(row.notAfter, row.maxValidityDays)) {
      throw new UnprocessableEntityException(
        `Issuer ${row.id}'s issuing window has closed: use its successor`,
      );
    }
    if (!this.allowsUsages(row, profile)) {
      throw new UnprocessableEntityException(
        `Issuer ${row.id} may not sign ${profile.id} certificates' usages`,
      );
    }
  }

  private async assertNew(id: string): Promise<void> {
    if (await this.prisma.issuer.findUnique({ where: { id } })) {
      throw new ConflictException(`Issuer ${id} already exists`);
    }
  }

  /** The issuer in Harpocrates that signed `certificate`, if any. */
  private async parentOf(
    certificate: string,
    chain: string[],
  ): Promise<IssuerRow | undefined> {
    const [nearest] = chain;
    if (!nearest) {
      const self = parseCertificate(certificate);
      if (self.subject !== self.issuer) {
        throw new BadRequestException(
          "A CA that is not self-signed is imported with its chain",
        );
      }
      return undefined;
    }
    if (!isIssuedBy(certificate, nearest)) {
      throw new UnprocessableEntityException(
        "The certificate is not signed by the first certificate of its chain",
      );
    }
    const parentDer = parseCertificate(nearest).der;
    const parent = await this.prisma.issuer.findFirst({
      where: { certificate: parentDer },
    });
    if (!parent) {
      throw new UnprocessableEntityException(
        "Import the CA's parent first: it is not in Harpocrates",
      );
    }
    return parent;
  }
}

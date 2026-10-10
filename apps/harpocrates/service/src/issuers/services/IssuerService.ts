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
  CaOverrides,
  CreateRootIssuerRequest,
  FullIssuer,
  ImportIssuerRequest,
  Issuer,
  IssuerShapeName,
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
  constraintRows,
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
  noTimeToSign,
  offlineMaxValidityDays,
  SHAPE_PATH_LENGTH,
  shapeOfPathLength,
  TIER_VALIDITY_DAYS,
} from "../issuingWindow";
import { overridesGiven, signerConstraints } from "../overrides";

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

  /**
   * A CA's subject from its parts: `organization` (its root's, or set for
   * it) begins the CN and is the O; without one, the configured realm and
   * organisation (ADR 0032, Names and settings).
   */
  subjectFor(parts: IssuerNameParts, organization?: string): string {
    return subjectName({
      commonName: issuerCommonName(organization ?? this.pki.realm, parts),
      organization: organization ?? this.pki.organization,
    });
  }

  /** The O a CA's subject carries: its own or its root's, or the configured one. */
  organizationFor(organization?: string): string {
    return organization ?? this.pki.organization;
  }

  /**
   * The subject a new CA gets: the one given outright, or the one built
   * from its parts. Either way it is new: a subject is never reused.
   */
  async newSubject(
    parts: IssuerNameParts,
    overrides: CaOverrides,
    organization?: string,
  ): Promise<string> {
    const subject = overrides.subject ?? this.subjectFor(parts, organization);
    if (await this.prisma.issuer.findUnique({ where: { subject } })) {
      throw new ConflictException(
        `A CA with the subject ${subject} exists: a subject is never reused`,
      );
    }
    return subject;
  }

  urlsFor(slug: string) {
    return distributionUrls(this.pki.distributionUrl, slug);
  }

  /**
   * A new root (ADR 0032): its shape sets its path length and what its
   * ceremonies sign; every setting starts at its default and may be
   * overridden. The signer generates its key, self-signs, and hands the key
   * back encrypted, once: the root is offline from its first moment.
   */
  async createRoot(
    principal: Principal,
    request: CreateRootIssuerRequest,
  ): Promise<{ issuer: FullIssuer; encryptedKey: string }> {
    const shape = request.shape ?? "three_tier";
    const parts: IssuerNameParts = {
      tier: "root",
      purpose: request.purpose,
      number: request.number,
      generation: request.generation,
    };
    const id = issuerSlug(parts);
    await this.assertNew(id);
    const subject = await this.newSubject(parts, request, request.organization);
    const notBefore = startNow();
    const notAfter = addDays(
      notBefore,
      request.validityDays ?? TIER_VALIDITY_DAYS.root,
    );
    const idle = noTimeToSign(
      notBefore,
      notAfter,
      offlineMaxValidityDays("root", shape),
    );
    if (idle) throw new UnprocessableEntityException(idle);
    const created = await this.signer.createRoot(
      {
        subject,
        serial: randomSerial(),
        notBefore: notBefore.toISOString(),
        notAfter: notAfter.toISOString(),
        keyUsage: ["key_cert_sign", "crl_sign"],
        ca: true,
        pathLength: SHAPE_PATH_LENGTH[shape],
        nameConstraints: signerConstraints(request.nameConstraints),
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
      organization: request.organization,
      shape,
      constraints: constraintRows(request.nameConstraints),
      overrides: overridesGiven(request),
    });
    return { issuer, encryptedKey: created.encryptedKey };
  }

  /**
   * Discards a root that has signed nothing (ADR 0032): no CA beneath it,
   * no certificate, no list. It is never published, and its number is not
   * used again: the record stays, revoked.
   */
  async discard(principal: Principal, issuerId: string): Promise<FullIssuer> {
    const row = await this.row(issuerId);
    if (row.tier !== "root") {
      throw new UnprocessableEntityException("Only a root is discarded");
    }
    if (row.discardedAt) return this.describe(issuerId);
    const [children, certificates, crls] = await Promise.all([
      this.prisma.issuer.count({ where: { parentId: issuerId } }),
      this.prisma.certificate.count({ where: { issuerId } }),
      this.prisma.crl.count({ where: { issuerId } }),
    ]);
    if (children + certificates + crls > 0) {
      throw new ConflictException(
        `${issuerId} has signed ${children} CAs, ${certificates} certificates and ${crls} lists: only a root that has signed nothing is discarded`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.issuer.update({
        where: { id: issuerId },
        data: { status: "revoked", discardedAt: new Date() },
      });
      await this.audit.record(
        {
          kind: AuditKind.IssuerDiscarded,
          principal,
          subjectType: "issuer",
          subjectId: issuerId,
          attributes: { subject: row.subject },
        },
        tx,
      );
    });
    return this.describe(issuerId);
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
      organization?: string;
      /** A root's; an imported root takes it from its path length. */
      shape?: IssuerShapeName;
      /** The settings given instead of their defaults, for the audit log. */
      overrides?: string[];
    },
  ): Promise<FullIssuer> {
    const certificate = parseCertificate(offline.certificatePem);
    const tier = offline.parts.tier as "root" | "intermediate";
    const shape =
      tier === "root"
        ? (offline.shape ?? shapeOfPathLength(certificate.pathLength))
        : undefined;
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
          maxValidityDays: offlineMaxValidityDays(tier, shape),
          organization: offline.organization,
          shape,
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
            shape,
            overrides: offline.overrides?.join(",") || undefined,
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
      if (request.closed) {
        throw new BadRequestException(
          "Only an issuing CA is imported closed; offline CAs sign no certificates anyway",
        );
      }
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
      closed: request.closed,
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
      /** Signs its lists and nothing new (an XCA CA kept to its end). */
      closed?: boolean;
      organization?: string;
      /** The settings given instead of their defaults, for the audit log. */
      overrides?: string[];
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
          status: issuing.closed ? "closed" : "active",
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
          organization: issuing.organization,
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
            status: issuing.closed ? "closed" : "active",
            overrides: issuing.overrides?.join(",") || undefined,
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

import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  Enrollment,
  Key,
  Prisma,
  RevocationReason,
} from "../../store/prisma";
import { createPrivateKey, randomBytes } from "crypto";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { type Principal, SYSTEM } from "../../auth/principal";
import { pkiConfig, type PkiConfigType } from "../../config/configuration";
import { CrlScheduler } from "../../crls/services/CrlScheduler";
import type { IssuerWithRules } from "../../issuers/converters/IssuerConverter";
import { addDays } from "../../issuers/issuingWindow";
import { IssuerService, startNow } from "../../issuers/services/IssuerService";
import { KeyService } from "../../keys/services/KeyService";
import {
  certificatesIssued,
  refusals,
  revocations,
} from "../../metrics/pkiMetrics";
import type {
  Certificate,
  CreateCeremonyCertificateRequest,
  CreateCertificateRequest,
  DownloadFormatName,
  ExportCertificateKeyRequest,
  ExportCertificateKeyResponse,
  FullCertificate,
  ImportedKey,
  ListCertificatesQuery,
  RenewCertificateRequest,
  RevokeCertificateRequest,
} from "../../model/certificates";
import {
  isNameType,
  type KeyAlgorithmName,
  type Names,
  type NameTypeName,
} from "../../model/common";
import {
  keyAlgorithmName,
  type ProfileWithRules,
} from "../../profiles/converters/ProfileConverter";
import { ProfileService } from "../../profiles/services/ProfileService";
import {
  bytes,
  certifiable,
  certificatePem,
  generatable,
  parseCertificate,
  parseCsr,
  randomSerial,
  spkiFromPem,
  spkiPem,
  spkiSha256,
  subjectName,
} from "../../pki/x509";
import {
  type CertificateSpec,
  SignerRefusal,
  SignerService,
} from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import {
  CERTIFICATE_LINEAGE,
  type CertificateWithLineage,
  stateOf,
  toDomainObject,
  toFullCertificate,
} from "../converters/CertificateConverter";

const DAY = 24 * 60 * 60 * 1000;

/** What a deploy target installs: PEM, the key unencrypted. */
export type DeployableCertificate = {
  certificate: string;
  /** The CAs above it, nearest first, without the root. */
  chain: string[];
  privateKey: string;
};

type NameRow = { type: NameTypeName; value: string };

/** What to certify: a subscriber's key, or one in the signer. */
type SubjectKey =
  | { kind: "csr"; csr: string; spki: Buffer }
  | { kind: "publicKey"; spki: Buffer }
  | {
      kind: "signer";
      signerKeyId: string;
      spki: Buffer;
      /** Generated in the signer, or brought by the operator. */
      origin: "generated" | "imported";
    };

type Lineage = { enrollment: Enrollment; key: Key; created: boolean };

const nameRows = (names: Names | undefined): NameRow[] =>
  Object.entries(names ?? {}).flatMap(([type, values]) =>
    isNameType(type)
      ? ((values as string[] | undefined) ?? []).map((value) => ({
          type,
          value,
        }))
      : [],
  );

const sameNames = (a: NameRow[], b: NameRow[]) => {
  const key = (rows: NameRow[]) =>
    rows
      .map((row) => `${row.type}:${row.value.toLowerCase()}`)
      .sort()
      .join(",");
  return key(a) === key(b);
};

const toSans = (rows: NameRow[]): Names => {
  const names: Names = {};
  for (const row of rows)
    names[row.type] = [...(names[row.type] ?? []), row.value];
  return names;
};

/**
 * Issuance, renewal, revocation and escrow export (ADR 0020, Keys and
 * enrollment; Serials, revocation and publication). The profile's rules
 * are applied here; the signer applies its own invariants again.
 */
@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly issuers: IssuerService,
    private readonly profiles: ProfileService,
    private readonly keys: KeyService,
    private readonly audit: AuditService,
    private readonly scheduler: CrlScheduler,
    @Inject(pkiConfig.KEY) private readonly pki: PkiConfigType,
  ) {}

  // ---- reading

  async describe(certificateId: string): Promise<FullCertificate> {
    const row = await this.row(certificateId);
    return toFullCertificate(row, await this.chainOf(row.issuerId));
  }

  async list(
    query: ListCertificatesQuery,
  ): Promise<{ count: number; certificates: Certificate[] }> {
    const now = new Date();
    const where: Prisma.CertificateWhereInput = {
      issuerId: query.issuerId,
      profileId: query.profileId,
      ...(query.state === "revoked" ? { status: "revoked" } : {}),
      ...(query.state === "valid"
        ? { status: "valid", notAfter: { gt: now } }
        : {}),
      ...(query.state === "expired"
        ? { status: "valid", notAfter: { lte: now } }
        : {}),
      ...(query.expiringWithinDays === undefined
        ? {}
        : {
            status: "valid",
            notAfter: {
              gt: now,
              lte: new Date(now.getTime() + query.expiringWithinDays * DAY),
            },
          }),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" } },
              { serial: { contains: query.search.toLowerCase() } },
              {
                enrollment: {
                  names: {
                    some: {
                      value: { contains: query.search, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const pageSize = query.pageSize ?? 50;
    const [count, rows] = await Promise.all([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where,
        include: CERTIFICATE_LINEAGE,
        orderBy: [{ notAfter: "asc" }, { id: "asc" }],
        skip: (query.startPage ?? 0) * pageSize,
        take: pageSize,
      }),
    ]);
    return { count, certificates: rows.map(toDomainObject) };
  }

  /** The certificate as a file: PEM, DER, or PEM with its chain. */
  async download(
    certificateId: string,
    format: DownloadFormatName,
  ): Promise<{ body: Buffer | string; contentType: string; fileName: string }> {
    const row = await this.row(certificateId);
    const name =
      `${row.subject.match(/CN=([^,]+)/)?.[1] ?? row.id}-${row.serial.slice(0, 8)}`.replace(
        /[^A-Za-z0-9._-]+/g,
        "_",
      );
    if (format === "der") {
      return {
        body: Buffer.from(row.der),
        contentType: "application/pkix-cert",
        fileName: `${name}.cer`,
      };
    }
    const pem = certificatePem(row.der);
    if (format === "pem") {
      return {
        body: pem,
        contentType: "application/x-pem-file",
        fileName: `${name}.pem`,
      };
    }
    const chain = await this.serverChainOf(row.issuerId);
    return {
      body: [pem, ...chain].join(""),
      contentType: "application/x-pem-file",
      fileName: `${name}-chain.pem`,
    };
  }

  // ---- issuing

  async create(
    principal: Principal,
    request: CreateCertificateRequest,
  ): Promise<FullCertificate> {
    return this.audited(principal, "create", request.profileId, async () => {
      const profile = await this.profiles.forNewCertificate(request.profileId);
      if (profile.directOnly) {
        throw new UnprocessableEntityException(
          `The ${profile.id} profile is issued only in a ceremony with a root that signs directly`,
        );
      }
      if (request.csr && request.key) {
        throw new BadRequestException("A CSR or a key, not both");
      }
      if (request.keyAlgorithm && (request.csr || request.key)) {
        throw new BadRequestException(
          "A key type is chosen only for a generated key",
        );
      }
      const escrow = this.escrowFor(profile, request);
      const names = nameRows(request.names);
      this.checkNames(profile, names);
      const subject = subjectName({
        commonName: request.subject.commonName,
        organizationalUnit: request.subject.organizationalUnit,
        organization: request.subject.organization ?? this.pki.organization,
      });
      const issuer = await this.issuers.forIssuance(profile, request.issuerId);
      this.checkValidity(profile, issuer);

      const subjectKey = request.csr
        ? await this.submittedKey(profile, request.csr)
        : request.key
          ? await this.importedKey(profile, request.key)
          : await this.generatedKey(profile, request.keyAlgorithm);
      let issued: FullCertificate;
      try {
        const lineage = await this.lineageFor(
          profile,
          subject,
          names,
          subjectKey,
        );
        issued = await this.issue(principal, {
          profile,
          issuer,
          subject,
          names,
          subjectKey,
          lineage,
          escrow,
          kind: AuditKind.CertificateIssued,
        });
      } catch (error: unknown) {
        // A key generated (or imported) for a request that did not issue
        // goes at once.
        if (subjectKey.kind === "signer") {
          await this.discardGenerated(subjectKey);
        }
        throw error;
      }
      if (
        subjectKey.kind === "signer" &&
        subjectKey.origin === "imported" &&
        escrow === false
      ) {
        await this.releaseImported(subjectKey);
        return this.describe(issued.id);
      }
      return issued;
    });
  }

  /**
   * A leaf signed directly by a root, in its ceremony (ADR 0032): the key
   * is generated in the signer, the certificate built from a direct-only
   * profile (the key identifiers alone, for `direct-minimal`).
   */
  async createInCeremony(
    principal: Principal,
    ceremonyId: string,
    request: CreateCeremonyCertificateRequest,
  ): Promise<FullCertificate> {
    const profileId = request.profileId ?? "direct-minimal";
    return this.audited(
      principal,
      "create-in-ceremony",
      profileId,
      async () => {
        const ceremony = await this.prisma.ceremony.findUnique({
          where: { id: ceremonyId },
        });
        if (!ceremony) {
          throw new NotFoundException(
            `Ceremony with id ${ceremonyId} not found`,
          );
        }
        if (ceremony.closedAt) {
          throw new ConflictException(`Ceremony ${ceremonyId} is closed`);
        }
        const issuer = await this.issuers.row(ceremony.issuerId);
        if (issuer.tier !== "root" || issuer.shape !== "direct") {
          throw new UnprocessableEntityException(
            `${issuer.id} does not sign leaves: only a root that signs directly does`,
          );
        }
        const profile = await this.profiles.forNewCertificate(profileId);
        if (!profile.directOnly) {
          throw new UnprocessableEntityException(
            `The ${profile.id} profile is issued by an issuing CA, not in a ceremony`,
          );
        }
        const validityDays = request.validityDays ?? profile.validityDays;
        if (validityDays > issuer.maxValidityDays) {
          throw new UnprocessableEntityException(
            `Issuer ${issuer.id} signs at most ${issuer.maxValidityDays} days`,
          );
        }
        const escrow = this.escrowFor(profile, request);
        const names = nameRows(request.names);
        this.checkNames(profile, names);
        const subject = subjectName({
          commonName: request.subject.commonName,
          organizationalUnit: request.subject.organizationalUnit,
          organization:
            request.subject.organization ??
            issuer.organization ??
            this.pki.organization,
        });
        const subjectKey = await this.generatedKey(profile);
        try {
          const lineage = await this.lineageFor(
            profile,
            subject,
            names,
            subjectKey,
          );
          return await this.issue(principal, {
            profile,
            issuer,
            subject,
            names,
            subjectKey,
            lineage,
            escrow,
            validityDays,
            sign: (spec) => this.signer.signInCeremony(ceremonyId, spec),
            kind: AuditKind.CertificateIssued,
          });
        } catch (error: unknown) {
          if (subjectKey.kind === "signer") {
            await this.discardGenerated(subjectKey);
          }
          throw error;
        }
      },
    );
  }

  async renew(
    principal: Principal,
    certificateId: string,
    request: RenewCertificateRequest,
  ): Promise<FullCertificate> {
    const current = await this.row(certificateId);
    return this.audited(
      principal,
      "renew",
      current.profileId ?? undefined,
      async () => {
        if (stateOf(current) === "revoked") {
          throw new ConflictException("A revoked certificate is not renewed");
        }
        if (current.renewedBy) {
          throw new ConflictException(
            `The certificate was already renewed by ${current.renewedBy.id}`,
          );
        }
        if (!current.enrollment || !current.profileId) {
          throw new UnprocessableEntityException(
            "Only certificates issued under a profile are renewed",
          );
        }
        // A renewal keeps the version its enrollment was issued under.
        const profile = await this.profiles.version(
          current.enrollment.profileVersionId,
        );
        const names = current.enrollment.names.map((n) => ({
          type: n.type as NameTypeName,
          value: n.value,
        }));
        const issuer = await this.issuers.forIssuance(profile);
        this.checkValidity(profile, issuer);
        const old = current.enrollment;
        const keyAge = Date.now() - old.key.createdAt.getTime();
        const young = keyAge < profile.maxKeyAgeDays * DAY;

        let subjectKey: SubjectKey;
        let lineage: Lineage;
        if (request.csr) {
          const submitted = await this.submittedKey(profile, request.csr);
          if (submitted.spki.equals(old.key.publicKey)) {
            this.checkKeyAge(young, profile);
            subjectKey = submitted;
            lineage = { enrollment: old, key: old.key, created: false };
          } else {
            subjectKey = submitted;
            lineage = await this.lineageFor(
              profile,
              current.subject,
              names,
              submitted,
              old.id,
            );
          }
        } else if (
          young &&
          old.key.location === "signer" &&
          old.key.signerKeyId &&
          !old.key.destroyedAt
        ) {
          subjectKey = {
            kind: "signer",
            signerKeyId: old.key.signerKeyId,
            spki: Buffer.from(old.key.publicKey),
            origin: old.mode === "imported" ? "imported" : "generated",
          };
          lineage = { enrollment: old, key: old.key, created: false };
        } else if (young && old.key.location === "subscriber") {
          subjectKey = {
            kind: "publicKey",
            spki: Buffer.from(old.key.publicKey),
          };
          lineage = { enrollment: old, key: old.key, created: false };
        } else if (old.mode === "generated" && profile.allowGenerated) {
          // A new key of the same type as the one it replaces.
          subjectKey = await this.generatedKey(
            profile,
            generatable(old.key.algorithm),
          );
          lineage = await this.lineageFor(
            profile,
            current.subject,
            names,
            subjectKey,
            old.id,
          );
        } else {
          throw new UnprocessableEntityException(
            `The key is older than the profile's ${profile.maxKeyAgeDays} days: renew with a CSR for a new key`,
          );
        }
        if (old.key.blockedAt && lineage.key.id === old.key.id) {
          throw new UnprocessableEntityException("The key is compromised");
        }
        return this.issue(principal, {
          profile,
          issuer,
          subject: current.subject,
          names,
          subjectKey,
          lineage,
          renews: current.id,
          kind: AuditKind.CertificateRenewed,
        });
      },
    );
  }

  // ---- revoking

  async revoke(
    principal: Principal,
    certificateId: string,
    request: RevokeCertificateRequest,
  ): Promise<Certificate[]> {
    const target = await this.row(certificateId);
    if (target.status === "revoked") {
      throw new ConflictException("The certificate is already revoked");
    }
    const compromised = request.reason === "keyCompromise";
    const key = target.enrollment?.key;
    // keyCompromise takes every certificate for the key with it.
    const lineage =
      compromised && target.enrollmentId
        ? await this.prisma.certificate.findMany({
            where: { enrollmentId: target.enrollmentId, status: "valid" },
          })
        : [target];
    const revokedIds = lineage.map((c) => c.id);

    await this.prisma.$transaction(async (tx) => {
      for (const certificate of lineage) {
        await tx.revocation.create({
          data: {
            certificateId: certificate.id,
            reason: request.reason as RevocationReason,
            comment: request.comment,
            principal: principal.id,
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
            reason: request.comment,
            attributes: {
              issuerId: certificate.issuerId,
              serial: certificate.serial,
              reason: request.reason,
            },
          },
          tx,
        );
      }
      // Each issuer's next list carries it: the scheduler signs one now.
      await tx.issuer.updateMany({
        where: { id: { in: [...new Set(lineage.map((c) => c.issuerId))] } },
        data: { crlDueAt: new Date() },
      });
      if (compromised && key && !key.blockedAt) {
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
    });

    for (const certificate of lineage) {
      revocations.inc({ issuer: certificate.issuerId, reason: request.reason });
    }
    void this.scheduler.kick();
    // An escrowed key goes with its lineage's last valid certificate.
    if (key?.location === "signer" && key.signerKeyId && !key.destroyedAt) {
      const remaining = await this.prisma.certificate.count({
        where: { enrollmentId: target.enrollmentId, status: "valid" },
      });
      if (compromised || remaining === 0) {
        await this.destroyEscrowed(principal, key);
      }
    }
    const rows = await this.prisma.certificate.findMany({
      where: { id: { in: revokedIds } },
      include: CERTIFICATE_LINEAGE,
    });
    return rows.map(toDomainObject);
  }

  // ---- escrow

  async exportKey(
    principal: Principal,
    certificateId: string,
    request: ExportCertificateKeyRequest,
  ): Promise<ExportCertificateKeyResponse> {
    const row = await this.row(certificateId);
    const key = row.enrollment?.key;
    if (!key || key.location !== "signer" || !key.signerKeyId) {
      throw new UnprocessableEntityException(
        "This certificate's key is not escrowed: only the subscriber has it",
      );
    }
    if (key.destroyedAt) {
      throw new ConflictException("The escrowed key has been destroyed");
    }
    const chain = await this.chainOf(row.issuerId);
    const data = await this.signer.exportKey(
      key.signerKeyId,
      request.format,
      request.passphrase,
      certificatePem(row.der),
      request.format === "pkcs12" ? chain : [],
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.escrowExport.create({
        data: {
          keyId: key.id,
          certificateId: row.id,
          format: request.format,
          principal: principal.id,
          reason: request.reason,
        },
      });
      await this.audit.record(
        {
          kind: AuditKind.KeyExported,
          principal,
          subjectType: "key",
          subjectId: key.id,
          reason: request.reason,
          attributes: { certificateId: row.id, format: request.format },
        },
        tx,
      );
    });
    // Not escrowed: this was its one export.
    if (key.exportOnce) {
      await this.destroyEscrowed(principal, key);
    }
    const base = (row.subject.match(/CN=([^,]+)/)?.[1] ?? row.id).replace(
      /[^A-Za-z0-9._-]+/g,
      "_",
    );
    return {
      format: request.format,
      fileName: `${base}.${request.format === "pem" ? "key.pem" : "p12"}`,
      data: data.toString("base64"),
    };
  }

  // ---- deployment

  /**
   * Refuses a certificate a deploy target cannot install: one not valid,
   * or whose key Harpocrates does not keep (a CSR's, or a generated key
   * exported once).
   */
  async checkDeployable(certificateId: string): Promise<void> {
    this.deployableKey(await this.row(certificateId));
  }

  /**
   * What a deploy target installs (ADR 0020, Renewal and delivery): the
   * certificate, the CAs above it but not the root, and its escrowed key
   * in the clear. The signer exports a key only encrypted, so it is
   * exported under a passphrase used once and decrypted here; it is never
   * logged or kept. Recorded as an escrow export whose reason names the
   * target.
   */
  async exportForDeployment(
    certificateId: string,
    target: string,
  ): Promise<DeployableCertificate> {
    const row = await this.row(certificateId);
    const key = this.deployableKey(row);
    const certificate = certificatePem(row.der);
    const passphrase = randomBytes(32).toString("base64url");
    const encrypted = await this.signer.exportKey(
      key.signerKeyId!,
      "pem",
      passphrase,
      certificate,
      [],
    );
    const privateKey = createPrivateKey({ key: encrypted, passphrase })
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    const reason = `Deployed to ${target}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.escrowExport.create({
        data: {
          keyId: key.id,
          certificateId: row.id,
          format: "deploy",
          principal: SYSTEM.id,
          reason,
        },
      });
      await this.audit.record(
        {
          kind: AuditKind.KeyExported,
          principal: SYSTEM,
          subjectType: "key",
          subjectId: key.id,
          reason,
          attributes: { certificateId: row.id, format: "deploy" },
        },
        tx,
      );
    });
    return {
      certificate,
      chain: await this.serverChainOf(row.issuerId),
      privateKey,
    };
  }

  private deployableKey(row: CertificateWithLineage): Key {
    const state = stateOf(row);
    if (state !== "valid") {
      throw new UnprocessableEntityException(
        `The certificate is ${state}: only a valid certificate is deployed`,
      );
    }
    const key = row.enrollment?.key;
    if (!key || key.location !== "signer" || !key.signerKeyId) {
      throw new UnprocessableEntityException(
        "Only a certificate whose key Harpocrates generated is deployed: this one's key is the subscriber's",
      );
    }
    if (key.destroyedAt || key.exportOnce) {
      throw new UnprocessableEntityException(
        "Only a certificate whose key is escrowed is deployed: this one's key was for one export",
      );
    }
    return key;
  }

  // ---- the parts

  private async row(certificateId: string): Promise<CertificateWithLineage> {
    const row = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: CERTIFICATE_LINEAGE,
    });
    if (!row) {
      throw new NotFoundException(
        `Certificate with id ${certificateId} not found`,
      );
    }
    return row;
  }

  /** The issuer's certificate and everything above it, nearest first. */
  private async chainOf(issuerId: string): Promise<string[]> {
    const issuer = await this.issuers.row(issuerId);
    return [
      ...(issuer.certificate ? [certificatePem(issuer.certificate)] : []),
      ...(await this.issuers.chainPems(issuer)),
    ];
  }

  /** The chain a server sends: the CAs above it, not the root. */
  private async serverChainOf(issuerId: string): Promise<string[]> {
    return (await this.chainOf(issuerId)).filter((ca) => {
      const parsed = parseCertificate(ca);
      return parsed.subject !== parsed.issuer;
    });
  }

  private checkNames(profile: ProfileWithRules, names: NameRow[]): void {
    const allowed = new Set(profile.nameTypes.map((t) => t.type));
    const refused = names.filter((name) => !allowed.has(name.type));
    if (refused.length) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile does not allow ${[...new Set(refused.map((n) => n.type))].join(", ")} names`,
      );
    }
    if (profile.requireSan && names.length === 0) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile needs at least one alternative name`,
      );
    }
  }

  private checkValidity(
    profile: ProfileWithRules,
    issuer: IssuerWithRules,
  ): void {
    if (profile.validityDays > issuer.maxValidityDays) {
      throw new UnprocessableEntityException(
        `Issuer ${issuer.id} signs at most ${issuer.maxValidityDays} days; the ${profile.id} profile asks ${profile.validityDays}`,
      );
    }
  }

  /**
   * Whether a generated key stays escrowed (ADR 0032): the profile's
   * setting, or the request's where the profile lets it choose. Off, the
   * key is exported once and then destroyed.
   */
  private escrowFor(
    profile: ProfileWithRules,
    request: { escrow?: boolean; csr?: string },
  ): boolean {
    if (request.escrow === undefined) return profile.escrow;
    if (request.csr) {
      throw new BadRequestException(
        "Escrow is for generated or imported keys: a CSR's key is the subscriber's",
      );
    }
    if (request.escrow !== profile.escrow && !profile.escrowOverridable) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile ${profile.escrow ? "escrows" : "does not escrow"} its keys, and a request may not choose otherwise`,
      );
    }
    return request.escrow;
  }

  private checkKeyAge(young: boolean, profile: ProfileWithRules): void {
    if (!young) {
      throw new UnprocessableEntityException(
        `The key is older than the profile's ${profile.maxKeyAgeDays} days: renew with a new key`,
      );
    }
  }

  private async submittedKey(
    profile: ProfileWithRules,
    pem: string,
  ): Promise<SubjectKey> {
    if (!profile.allowCsr) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile does not take a CSR: its key is generated`,
      );
    }
    let csr;
    try {
      csr = await parseCsr(pem);
    } catch {
      throw new BadRequestException("The CSR is not PEM");
    }
    if (!csr.signatureValid) {
      throw new UnprocessableEntityException(
        "The CSR's signature does not verify",
      );
    }
    if (!certifiable(csr.algorithm)) {
      throw new UnprocessableEntityException(
        `${csr.algorithm} keys are not certified: RSA or DSA of at least 2048 bits, P-256, P-384, P-521 or Ed25519`,
      );
    }
    this.keys.checkNotWeak(csr.spki);
    return { kind: "csr", csr: pem, spki: csr.spki };
  }

  /** A key generated in the signer: of the type asked for, or the profile's. */
  private async generatedKey(
    profile: ProfileWithRules,
    algorithm?: KeyAlgorithmName,
  ): Promise<SubjectKey> {
    if (!profile.allowGenerated) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile takes a CSR: its keys are the subscriber's`,
      );
    }
    const key = await this.signer.generateKey(
      "subject",
      algorithm ?? keyAlgorithmName(profile),
    );
    return {
      kind: "signer",
      signerKeyId: key.id,
      spki: spkiFromPem(key.publicKey),
      origin: "generated",
    };
  }

  /**
   * A key the operator brings, decrypted and kept by the signer as a
   * generated one is; so only where the profile allows a generated key
   * (a CSR-only profile's keys never leave the subscriber).
   */
  private async importedKey(
    profile: ProfileWithRules,
    imported: ImportedKey,
  ): Promise<SubjectKey> {
    if (!profile.allowGenerated) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile takes a CSR: its keys are the subscriber's`,
      );
    }
    const key = await this.signer
      .importKey("subject", imported.data, imported.passphrase, imported.format)
      .catch((error: unknown) => {
        if (error instanceof ConflictException) {
          throw new ConflictException(
            "The signer has held this key before: bring a new one",
          );
        }
        throw error;
      });
    const spki = spkiFromPem(key.publicKey);
    try {
      this.keys.checkNotWeak(spki);
    } catch (error: unknown) {
      await this.signer.destroyKey(key.id).catch(() => undefined);
      throw error;
    }
    return { kind: "signer", signerKeyId: key.id, spki, origin: "imported" };
  }

  /**
   * An imported key not to be escrowed: the signer forgets it once it is
   * certified, and only the subscriber, who brought it, has it.
   */
  private async releaseImported(
    subjectKey: Extract<SubjectKey, { kind: "signer" }>,
  ): Promise<void> {
    await this.signer.destroyKey(subjectKey.signerKeyId);
    await this.prisma.key.update({
      where: { signerKeyId: subjectKey.signerKeyId },
      data: { location: "subscriber", signerKeyId: null },
    });
  }

  /**
   * The enrollment a key issues under (ADR 0020, Keys and enrollment): a
   * new key starts one; a known key is its own enrollment's renewal only
   * with the same profile, subject and names, and is otherwise refused.
   */
  private async lineageFor(
    profile: ProfileWithRules,
    subject: string,
    names: NameRow[],
    subjectKey: SubjectKey,
    replaces?: string,
  ): Promise<Lineage> {
    const known = await this.prisma.key.findUnique({
      where: { spkiSha256: spkiSha256(subjectKey.spki) },
      include: { enrollment: { include: { names: true } } },
    });
    if (known) {
      if (known.blockedAt) {
        throw new UnprocessableEntityException(
          "The key was revoked for keyCompromise: it is never certified again",
        );
      }
      if (known.purpose === "issuer") {
        throw new UnprocessableEntityException("The key is a CA's key");
      }
      const enrollment = known.enrollment;
      if (
        !enrollment ||
        enrollment.profileId !== profile.id ||
        enrollment.subject !== subject ||
        !sameNames(
          enrollment.names.map((n) => ({
            type: n.type as NameTypeName,
            value: n.value,
          })),
          names,
        )
      ) {
        throw new ConflictException(
          "The key belongs to another request: one key, one request",
        );
      }
      if (
        Date.now() - known.createdAt.getTime() >=
        profile.maxKeyAgeDays * DAY
      ) {
        throw new UnprocessableEntityException(
          `The key is older than the profile's ${profile.maxKeyAgeDays} days: use a new key`,
        );
      }
      return { enrollment, key: known, created: false };
    }
    return this.prisma.$transaction(async (tx) => {
      const key = await this.keys.record(tx, {
        spki: subjectKey.spki,
        purpose: "subject",
        location: subjectKey.kind === "signer" ? "signer" : "subscriber",
        signerKeyId:
          subjectKey.kind === "signer" ? subjectKey.signerKeyId : undefined,
      });
      const enrollment = await tx.enrollment.create({
        data: {
          keyId: key.id,
          profileId: profile.id,
          profileVersionId: profile.versionId,
          mode: subjectKey.kind === "signer" ? subjectKey.origin : "csr",
          subject,
          csr:
            subjectKey.kind === "csr"
              ? bytes(Buffer.from(subjectKey.csr, "utf8"))
              : undefined,
          replacesId: replaces,
          names: { create: names },
        },
      });
      return { enrollment, key, created: true };
    });
  }

  private async issue(
    principal: Principal,
    issuance: {
      profile: ProfileWithRules;
      issuer: IssuerWithRules;
      subject: string;
      names: NameRow[];
      subjectKey: SubjectKey;
      lineage: Lineage;
      renews?: string;
      /** Whether a generated key stays escrowed; off, it is exported once. */
      escrow?: boolean;
      /** Instead of the profile's (a ceremony's leaf may be shorter). */
      validityDays?: number;
      /** How it is signed: by the issuing CA, unless a ceremony signs it. */
      sign?: (spec: CertificateSpec) => Promise<string>;
      kind:
        | typeof AuditKind.CertificateIssued
        | typeof AuditKind.CertificateRenewed;
    },
  ): Promise<FullCertificate> {
    const { profile, issuer, subjectKey } = issuance;
    const notBefore = startNow();
    const minimal = profile.extensions === "minimal";
    const spec: CertificateSpec = {
      subject: issuance.subject,
      serial: randomSerial(),
      notBefore: notBefore.toISOString(),
      notAfter: addDays(
        notBefore,
        issuance.validityDays ?? profile.validityDays,
      ).toISOString(),
      ...(minimal
        ? { keyUsage: [], extensions: "minimal" }
        : {
            keyUsage: profile.keyUsages.map(
              (u) => u.usage,
            ) as CertificateSpec["keyUsage"],
            extendedKeyUsages: profile.extendedKeyUsages.map((u) => u.oid),
            sans: toSans(issuance.names),
            crlDistributionPoints: [issuer.crlUrl],
            issuerUrls: [issuer.caIssuersUrl],
          }),
      ...(subjectKey.kind === "csr" ? { csr: subjectKey.csr } : {}),
      ...(subjectKey.kind === "publicKey"
        ? { publicKey: spkiPem(subjectKey.spki) }
        : {}),
      ...(subjectKey.kind === "signer"
        ? { keyId: subjectKey.signerKeyId }
        : {}),
    };
    const pem = issuance.sign
      ? await issuance.sign(spec)
      : await this.signer.signCertificate(issuer.id, spec);
    const parsed = parseCertificate(pem);
    const id = await this.prisma.$transaction(async (tx) => {
      if (
        subjectKey.kind === "signer" &&
        subjectKey.origin === "generated" &&
        issuance.escrow === false &&
        issuance.lineage.created
      ) {
        await tx.key.update({
          where: { id: issuance.lineage.key.id },
          data: { exportOnce: true },
        });
      }
      const created = await tx.certificate.create({
        data: {
          issuerId: issuer.id,
          serial: parsed.serial,
          enrollmentId: issuance.lineage.enrollment.id,
          profileId: profile.id,
          profileVersionId: profile.versionId,
          subject: parsed.subject,
          notBefore: parsed.notBefore,
          notAfter: parsed.notAfter,
          der: parsed.der,
          renewsId: issuance.renews,
        },
      });
      if (issuance.lineage.created) {
        await this.audit.record(
          {
            kind:
              subjectKey.kind === "signer"
                ? AuditKind.KeyGenerated
                : AuditKind.KeyImported,
            principal,
            subjectType: "key",
            subjectId: issuance.lineage.key.id,
            attributes: {
              algorithm: issuance.lineage.key.algorithm,
              location: issuance.lineage.key.location,
              spkiSha256: issuance.lineage.key.spkiSha256,
              enrollmentId: issuance.lineage.enrollment.id,
            },
          },
          tx,
        );
      }
      await this.audit.record(
        {
          kind: issuance.kind,
          principal,
          subjectType: "certificate",
          subjectId: created.id,
          attributes: {
            issuerId: issuer.id,
            profileId: profile.id,
            profileVersion: profile.version,
            serial: parsed.serial,
            subject: parsed.subject,
            notAfter: parsed.notAfter.toISOString(),
            enrollmentId: issuance.lineage.enrollment.id,
            renews: issuance.renews,
          },
        },
        tx,
      );
      return created.id;
    });
    certificatesIssued.inc({ issuer: issuer.id, profile: profile.id });
    return this.describe(id);
  }

  private async discardGenerated(
    subjectKey: Extract<SubjectKey, { kind: "signer" }>,
  ): Promise<void> {
    const recorded = await this.prisma.key.findUnique({
      where: { signerKeyId: subjectKey.signerKeyId },
      include: { enrollment: { include: { certificates: true } } },
    });
    if (recorded?.enrollment?.certificates.length) return;
    await this.signer.destroyKey(subjectKey.signerKeyId).catch(() => undefined);
    if (recorded) {
      await this.prisma.key.update({
        where: { id: recorded.id },
        data: { destroyedAt: new Date() },
      });
    }
  }

  private async destroyEscrowed(principal: Principal, key: Key): Promise<void> {
    await this.signer.destroyKey(key.signerKeyId!);
    await this.prisma.$transaction(async (tx) => {
      await tx.key.update({
        where: { id: key.id },
        data: { destroyedAt: new Date() },
      });
      await this.audit.record(
        {
          kind: AuditKind.KeyDestroyed,
          principal,
          subjectType: "key",
          subjectId: key.id,
          attributes: { spkiSha256: key.spkiSha256 },
        },
        tx,
      );
    });
  }

  /** Runs an issuance, recording a refusal (422) in the audit log. */
  private async audited<T>(
    principal: Principal,
    operation: string,
    profileId: string | undefined,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error: unknown) {
      if (error instanceof HttpException && error.getStatus() === 422) {
        const invariant =
          error instanceof SignerRefusal ? error.invariant : "profile";
        refusals.inc({ invariant });
        await this.audit.record({
          kind: AuditKind.RequestRefused,
          principal,
          reason: error.message,
          attributes: {
            operation,
            profileId,
            invariant,
          },
        });
      }
      throw error;
    }
  }
}

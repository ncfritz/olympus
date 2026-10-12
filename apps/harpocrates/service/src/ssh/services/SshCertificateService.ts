import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { generateKeyPairSync, randomBytes } from "crypto";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { type Principal, PkiRole } from "../../auth/principal";
import { KeyService } from "../../keys/services/KeyService";
import type { RevocationReasonName } from "../../model/certificates";
import type {
  ProfilePreview,
  ProfilePreviewSample,
  ProfileSettings,
} from "../../model/profiles";
import type {
  CreateSshHostCertificateRequest,
  CreateSshUserCertificateRequest,
  DescribeMySshResponse,
  ListSshCertificatesQuery,
  SshCertificate,
  SshCertificateTypeName,
} from "../../model/ssh";
import { parseSshPublicKey, type SshPublicKey } from "../../pki/ssh";
import {
  keyAlgorithmName,
  type ProfileWithRules,
  unsavedVersion,
} from "../../profiles/converters/ProfileConverter";
import { keyAlgorithmProblem } from "../../profiles/rules";
import { ProfileService } from "../../profiles/services/ProfileService";
import {
  type SshCertificateSpec,
  SignerService,
} from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import type { SshCa as SshCaRow } from "../../store/prisma";
import {
  SSH_CERTIFICATE_RELATIONS,
  toSshCertificate,
  toSshCertificateContents,
} from "../converters/SshCertificateConverter";
import { SshCaService } from "./SshCaService";
import { SshKrlService } from "./SshKrlService";
import { identityKey, SshPrincipalService } from "./SshPrincipalService";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** A clock a few minutes behind still takes a new certificate. */
const SKEW_MS = 5 * 60 * 1000;

/** A 64-bit serial, hex, never zero. */
const sshSerial = (): string => {
  const serial = randomBytes(8);
  serial[0] |= 0x01;
  return serial.toString("hex");
};

/** An Ed25519 public key, OpenSSH format: a preview's sample. */
const sampleSshKey = (): string => {
  const raw = generateKeyPairSync("ed25519")
    .publicKey.export({ type: "spki", format: "der" })
    .subarray(-32);
  const field = (data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, data]);
  };
  const blob = Buffer.concat([field(Buffer.from("ssh-ed25519")), field(raw)]);
  return `ssh-ed25519 ${blob.toString("base64")} preview`;
};

/** What a certificate is to say, decided before it is signed. */
export type Issuance = {
  profile: ProfileWithRules;
  type: SshCertificateTypeName;
  key: SshPublicKey;
  principals: string[];
  identity?: string;
  issuedBy: Principal;
  renews?: string;
};

/**
 * SSH certificates (ADR 0035): a user's, for their own key and their
 * mapped principals, or by an admin for any mapped identity; a host's, by
 * an admin. Keys follow the X.509 model: seen once, never across X.509 and
 * SSH, reissued only for the same profile and principals.
 */
@Injectable()
export class SshCertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly keys: KeyService,
    private readonly profiles: ProfileService,
    private readonly cas: SshCaService,
    private readonly principals: SshPrincipalService,
    private readonly krls: SshKrlService,
    private readonly audit: AuditService,
  ) {}

  // ---- reading

  async list(query: ListSshCertificatesQuery): Promise<SshCertificate[]> {
    const now = new Date();
    const rows = await this.prisma.sshCertificate.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(query.current === "true"
          ? { status: "valid", validBefore: { gt: now } }
          : {}),
      },
      include: SSH_CERTIFICATE_RELATIONS,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.map(toSshCertificate);
  }

  async describe(id: string): Promise<SshCertificate> {
    const row = await this.prisma.sshCertificate.findUnique({
      where: { id },
      include: SSH_CERTIFICATE_RELATIONS,
    });
    if (!row) {
      throw new NotFoundException(`SSH certificate with id ${id} not found`);
    }
    return toSshCertificate(row);
  }

  /** The signed-in identity's principals and user certificates. */
  async mine(email: string): Promise<DescribeMySshResponse> {
    const identity = identityKey(email);
    const rows = await this.prisma.sshCertificate.findMany({
      where: { identity, type: "user" },
      include: SSH_CERTIFICATE_RELATIONS,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      identity,
      principals: await this.principals.principalsOf(identity),
      certificates: rows.map(toSshCertificate),
      hostTrustLines: await this.cas.hostTrustLines(),
    };
  }

  // ---- issuing

  /**
   * A user certificate: for the signed-in identity, or (by a pki-admin)
   * for another mapped one; its principals the mapped ones, or fewer.
   */
  async issueUser(
    principal: Principal,
    signedInAs: string | undefined,
    request: CreateSshUserCertificateRequest,
  ): Promise<SshCertificate> {
    const admin = principal.roles.includes(PkiRole.Admin);
    const asked = request.identity ? identityKey(request.identity) : undefined;
    const self = signedInAs ? identityKey(signedInAs) : undefined;
    if (asked && asked !== self && !admin) {
      throw new ForbiddenException(
        "Only a pki-admin issues a user certificate for someone else",
      );
    }
    const identity = asked ?? self;
    if (!identity) {
      throw new BadRequestException("Whom is it for? Give an identity");
    }
    const profile = await this.profiles.forNewSshCertificate(
      request.profileId ?? "ssh-user",
      "user",
    );
    const mapped = await this.principals.principalsOf(identity);
    if (!mapped.length) {
      throw new ForbiddenException(
        `${identity} may not log in as anyone: a pki-admin maps its principals first`,
      );
    }
    const principals = request.principals ?? mapped;
    const unmapped = principals.filter((p) => !mapped.includes(p));
    if (unmapped.length) {
      throw new ForbiddenException(
        `${identity} is not mapped to ${unmapped.join(", ")}`,
      );
    }
    return this.issue({
      profile,
      type: "user",
      key: this.parsed(request.publicKey),
      principals,
      identity,
      issuedBy: principal,
    });
  }

  /** A host certificate, its principals the host's names. */
  async issueHost(
    principal: Principal,
    request: CreateSshHostCertificateRequest,
  ): Promise<SshCertificate> {
    const profile = await this.profiles.forNewSshCertificate(
      request.profileId ?? "ssh-host",
      "host",
    );
    return this.issue({
      profile,
      type: "host",
      key: this.parsed(request.publicKey),
      principals: request.principals.map((p) => p.toLowerCase()),
      issuedBy: principal,
    });
  }

  /** Signs and records a certificate the profile's rules allow. */
  async issue(issuance: Issuance): Promise<SshCertificate> {
    const { profile, key, principals } = issuance;
    const problem = keyAlgorithmProblem(
      profile.keyAlgorithms.map((k) =>
        keyAlgorithmName({ keyAlgorithm: k.algorithm }),
      ),
      key.algorithm as Parameters<typeof keyAlgorithmProblem>[1],
    );
    if (problem) {
      throw new UnprocessableEntityException(
        `The ${profile.id} profile refuses the key: ${problem}`,
      );
    }
    this.keys.checkNotWeak(key.spki);
    const known = await this.knownKey(issuance);
    const ca = await this.cas.forIssuance(issuance.type, profile.ssh!.sshCaId);
    const spec = this.specFor(issuance, ca);
    const certificate = await this.signer.signSshCertificate(ca.id, spec);
    const id = await this.prisma.$transaction(async (tx) => {
      const keyRow =
        known ??
        (await this.keys.record(tx, {
          spki: key.spki,
          purpose: "subject",
          location: "subscriber",
        }));
      const created = await tx.sshCertificate.create({
        data: {
          sshCaId: ca.id,
          profileId: profile.id,
          profileVersionId: profile.versionId,
          keyId: keyRow.id,
          type: issuance.type,
          serial: spec.serial,
          keyIdentifier: spec.keyId,
          identity: issuance.identity,
          fingerprint: key.fingerprint,
          validAfter: new Date(spec.validAfter),
          validBefore: new Date(spec.validBefore),
          certificate: certificate.trim(),
          issuedBy: issuance.issuedBy.id,
          renewsId: issuance.renews,
          principals: {
            create: principals.map((principal, position) => ({
              principal,
              position,
            })),
          },
        },
      });
      await this.audit.record(
        {
          kind: issuance.renews
            ? AuditKind.SshCertificateRenewed
            : AuditKind.SshCertificateIssued,
          principal: issuance.issuedBy,
          subjectType: "ssh-certificate",
          subjectId: created.id,
          attributes: {
            caId: ca.id,
            profileId: profile.id,
            profileVersion: profile.version,
            serial: spec.serial,
            keyId: spec.keyId,
            principals: principals.join(","),
            fingerprint: key.fingerprint,
          },
        },
        tx,
      );
      return created.id;
    });
    return this.describe(id);
  }

  // ---- revoking

  /**
   * Revokes a certificate and writes its CA's KRL at once. keyCompromise
   * blocks the key for good and revokes its other SSH certificates.
   */
  async revoke(
    principal: Principal,
    id: string,
    reason: RevocationReasonName = "unspecified",
    comment?: string,
  ): Promise<SshCertificate> {
    const row = await this.prisma.sshCertificate.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`SSH certificate with id ${id} not found`);
    }
    if (row.status === "revoked") {
      throw new ConflictException(`SSH certificate ${id} is already revoked`);
    }
    const now = new Date();
    const affected = await this.prisma.$transaction(async (tx) => {
      const ids =
        reason === "keyCompromise"
          ? (
              await tx.sshCertificate.findMany({
                where: { keyId: row.keyId, status: "valid" },
                select: { id: true },
              })
            ).map((c) => c.id)
          : [id];
      const revoked = await tx.sshCertificate.findMany({
        where: { id: { in: ids } },
      });
      await tx.sshCertificate.updateMany({
        where: { id: { in: ids } },
        data: { status: "revoked", revokedAt: now, revocationReason: reason },
      });
      if (reason === "keyCompromise") {
        await tx.key.update({
          where: { id: row.keyId },
          data: { blockedAt: now },
        });
      }
      await tx.sshCa.updateMany({
        where: { id: { in: [...new Set(revoked.map((c) => c.sshCaId))] } },
        data: { krlDueAt: now },
      });
      for (const certificate of revoked) {
        await this.audit.record(
          {
            kind: AuditKind.SshCertificateRevoked,
            principal,
            subjectType: "ssh-certificate",
            subjectId: certificate.id,
            reason: comment,
            attributes: {
              caId: certificate.sshCaId,
              serial: certificate.serial,
              reason,
            },
          },
          tx,
        );
      }
      return revoked.map((c) => c.sshCaId);
    });
    // The KRLs go out now; were writing to fail, the schedule retries.
    for (const caId of new Set(affected)) {
      await this.krls.writeKrl(caId).catch(() => undefined);
    }
    return this.describe(id);
  }

  // ---- previewing

  /**
   * The certificate an SSH version would produce (ADR 0034, preview): a
   * sample request through the version's rules, built by the signer under
   * a throwaway key for a CA of its type.
   */
  async preview(
    settings: ProfileSettings,
    problems: string[],
    sample: ProfilePreviewSample,
  ): Promise<ProfilePreview> {
    const profile = unsavedVersion(settings, {
      id: "preview",
      kind: "ssh",
      description: "",
      directOnly: false,
    });
    const type = settings.ssh!.certificateType;
    const principals =
      type === "user"
        ? ["preview"]
        : (sample.names?.dns ?? ["preview.example.com"]);
    const preview: ProfilePreview = {
      problems,
      refusals: [],
      sampleSubject: {},
      sampleNames: type === "host" ? { dns: principals } : {},
      keyAlgorithm: "Ed25519",
    };
    if (problems.length) return preview;
    try {
      const ca = await this.cas.forIssuance(type, settings.ssh!.sshCaId);
      preview.issuerId = ca.id;
      const key = parseSshPublicKey(sampleSshKey());
      const problem = keyAlgorithmProblem(settings.keyAlgorithms, "Ed25519");
      if (problem) {
        preview.refusals.push(problem);
        return preview;
      }
      const spec = this.specFor(
        {
          profile,
          type,
          key,
          principals,
          identity: type === "user" ? "preview@example.com" : undefined,
          issuedBy: { id: "preview", roles: [], authTime: 0, surface: "api" },
        },
        ca,
      );
      preview.certificate = (
        await this.signer.previewSshCertificate({
          certificate: spec,
          kind: type,
          maxValiditySeconds: ca.maxValidityHours * 3600,
        })
      ).trim();
      preview.sshCertificate = toSshCertificateContents(preview.certificate);
    } catch (error: unknown) {
      if (!(error instanceof HttpException) || error.getStatus() >= 500) {
        throw error;
      }
      preview.refusals.push(error.message);
    }
    return preview;
  }

  // ---- the rules

  /** What the signer is asked to sign. */
  private specFor(issuance: Issuance, ca: SshCaRow): SshCertificateSpec {
    const ssh = issuance.profile.ssh!;
    if (ssh.validityHours > ca.maxValidityHours) {
      throw new UnprocessableEntityException(
        `SSH CA ${ca.id} signs for at most ${ca.maxValidityHours} hours; the ${issuance.profile.id} profile asks ${ssh.validityHours}`,
      );
    }
    const serial = sshSerial();
    const now = Date.now();
    const user = issuance.type === "user";
    return {
      kind: issuance.type,
      publicKey: `${issuance.key.type} ${issuance.key.blob.toString("base64")}`,
      serial,
      keyId: `${user ? issuance.identity : issuance.principals[0]}:${serial}`,
      principals: issuance.principals,
      validAfter: new Date(now - SKEW_MS).toISOString(),
      validBefore: new Date(now + ssh.validityHours * HOUR).toISOString(),
      ...(user
        ? {
            forceCommand: ssh.forceCommand ?? undefined,
            sourceAddresses: [...issuance.profile.sshSourceAddresses]
              .sort((a, b) => a.id - b.id)
              .map((a) => a.value),
            extensions: issuance.profile.sshExtensions.map(
              (e) =>
                e.extension as NonNullable<
                  SshCertificateSpec["extensions"]
                >[number],
            ),
          }
        : {}),
    };
  }

  /**
   * The key as Harpocrates has seen it (ADR 0020's key model): never an
   * issuer's, an X.509 subject's or a blocked one; reissued only for the
   * same profile, type and principals, while younger than the profile's
   * maximum key age. None, when it is new.
   */
  private async knownKey(issuance: Issuance) {
    const key = await this.keys.findBySpki(issuance.key.spki);
    if (!key) return undefined;
    if (key.purpose === "issuer") {
      throw new UnprocessableEntityException("The key is a CA's key");
    }
    if (key.blockedAt) {
      throw new UnprocessableEntityException(
        "The key was revoked as compromised: it is never certified again",
      );
    }
    if (await this.prisma.enrollment.findUnique({ where: { keyId: key.id } })) {
      throw new ConflictException(
        "The key is an X.509 certificate's: an SSH certificate needs its own",
      );
    }
    const last = await this.prisma.sshCertificate.findFirst({
      where: { keyId: key.id },
      include: { principals: true },
      orderBy: { createdAt: "desc" },
    });
    if (last) {
      const before = last.principals
        .map((p) => p.principal)
        .sort()
        .join(",");
      if (
        last.profileId !== issuance.profile.id ||
        last.type !== issuance.type ||
        before !== [...issuance.principals].sort().join(",")
      ) {
        throw new ConflictException(
          `The key is certified for ${last.profileId} as ${before}: it is reissued only for the same`,
        );
      }
    }
    if (
      key.createdAt.getTime() + issuance.profile.maxKeyAgeDays * DAY <
      Date.now()
    ) {
      throw new UnprocessableEntityException(
        `The key is older than the ${issuance.profile.id} profile's ${issuance.profile.maxKeyAgeDays} days: certify a new one`,
      );
    }
    return key;
  }

  private parsed(publicKey: string): SshPublicKey {
    try {
      return parseSshPublicKey(publicKey);
    } catch (error: unknown) {
      throw new BadRequestException(
        `The public key is not one OpenSSH certifies: ${(error as Error).message}`,
      );
    }
  }
}

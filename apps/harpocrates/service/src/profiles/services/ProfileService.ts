import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Prisma } from "../../store/prisma";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import type {
  BaseProfile,
  CopyProfileRequest,
  MoveProfileEnrollmentsRequest,
  PartialProfile,
  Profile,
  ProfileSettings,
  ProfileVersion,
} from "../../model/profiles";
import { PrismaService } from "../../store/PrismaService";
import {
  asProfileWithRules,
  KEY_ALGORITHM_ROWS,
  PROFILE_WITH_VERSION,
  type ProfileWithRules,
  toDomainObject,
  toProfileVersion,
  toSettings,
  VERSION_RULES,
} from "../converters/ProfileConverter";

/** The settings a version holds, in the order they are compared. */
const SETTINGS: (keyof ProfileSettings)[] = [
  "issuerId",
  "issuerPurpose",
  "keyAlgorithm",
  "validityDays",
  "renewAtDays",
  "maxKeyAgeDays",
  "allowCsr",
  "allowGenerated",
  "legacyExport",
  "requireSan",
  "escrow",
  "escrowOverridable",
  "extensions",
  "keyUsages",
  "extendedKeyUsages",
  "nameTypes",
];

/** Two settings' values the same: lists compared as sets. */
const same = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && [...a].sort().join() === [...b].sort().join()
    : (a ?? null) === (b ?? null);

/**
 * Profiles (ADR 0020, 0034): each read as its latest version, which new
 * certificates take; a renewal reads the version it was issued under.
 * Made, edited (each change of settings its next version), copied,
 * deactivated and reactivated by an admin; every change audited.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<Profile[]> {
    const rows = await this.prisma.profile.findMany({
      include: {
        versions: {
          include: { ...PROFILE_WITH_VERSION },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
    });
    return rows.map((row) =>
      toDomainObject(asProfileWithRules(row.versions[0])),
    );
  }

  async describe(profileId: string): Promise<Profile> {
    return toDomainObject(await this.row(profileId));
  }

  /** A profile as its latest version: what a new certificate takes. */
  async row(profileId: string): Promise<ProfileWithRules> {
    const latest = await this.prisma.profileVersion.findFirst({
      where: { profileId },
      include: PROFILE_WITH_VERSION,
      orderBy: { version: "desc" },
    });
    if (!latest) {
      throw new NotFoundException(`Profile with id ${profileId} not found`);
    }
    return asProfileWithRules(latest);
  }

  /**
   * A profile as its latest version, for a new certificate: refused when
   * it is deactivated, as only what was issued under it may still renew.
   */
  async forNewCertificate(profileId: string): Promise<ProfileWithRules> {
    const profile = await this.row(profileId);
    if (profile.deactivatedAt) {
      throw new UnprocessableEntityException(
        `The ${profileId} profile is deactivated: no new certificate may choose it`,
      );
    }
    return profile;
  }

  /** A profile as one of its versions: what a renewal under it takes. */
  async version(profileVersionId: string): Promise<ProfileWithRules> {
    const version = await this.prisma.profileVersion.findUnique({
      where: { id: profileVersionId },
      include: PROFILE_WITH_VERSION,
    });
    if (!version) {
      throw new NotFoundException(
        `Profile version with id ${profileVersionId} not found`,
      );
    }
    return asProfileWithRules(version);
  }

  /** A profile's versions, newest first. */
  async versions(profileId: string): Promise<ProfileVersion[]> {
    await this.row(profileId);
    const rows = await this.prisma.profileVersion.findMany({
      where: { profileId },
      include: VERSION_RULES,
      orderBy: { version: "desc" },
    });
    return rows.map(toProfileVersion);
  }

  // ---- changes

  async create(principal: Principal, base: BaseProfile): Promise<Profile> {
    const { id, description, ...settings } = base;
    await this.checkSettings(settings);
    await this.prisma.$transaction(async (tx) => {
      if (await tx.profile.findUnique({ where: { id } })) {
        throw new ConflictException(`A profile named ${id} already exists`);
      }
      await tx.profile.create({ data: { id, description } });
      await this.writeVersion(tx, principal, id, 1, settings);
      await this.audit.record(
        {
          kind: AuditKind.ProfileCreated,
          principal,
          subjectType: "profile",
          subjectId: id,
          attributes: { version: 1 },
        },
        tx,
      );
    });
    return this.describe(id);
  }

  /**
   * Edits a profile: what is given changes, the rest carries over. A change
   * of settings is its next version; the description alone is the
   * profile's own and makes none.
   */
  async update(
    principal: Principal,
    profileId: string,
    changes: PartialProfile,
  ): Promise<Profile> {
    const latest = await this.row(profileId);
    const { description, ...given } = changes;
    const current = toSettings(latest);
    const next = { ...current } as ProfileSettings;
    for (const key of SETTINGS) {
      if (given[key] !== undefined) {
        (next as unknown as Record<string, unknown>)[key] = given[key];
      }
    }
    const changed = SETTINGS.filter((key) => !same(current[key], next[key]));
    const describes =
      description !== undefined && description !== latest.description;
    if (changed.length === 0 && !describes) return this.describe(profileId);
    if (changed.length) await this.checkSettings(next);

    await this.prisma.$transaction(async (tx) => {
      if (describes) {
        await tx.profile.update({
          where: { id: profileId },
          data: { description },
        });
      } else {
        // The profile changed, through its new version.
        await tx.profile.update({
          where: { id: profileId },
          data: { updatedAt: new Date() },
        });
      }
      const version = changed.length ? latest.version + 1 : undefined;
      if (version) {
        await this.writeVersion(tx, principal, profileId, version, next);
      }
      await this.audit.record(
        {
          kind: AuditKind.ProfileUpdated,
          principal,
          subjectType: "profile",
          subjectId: profileId,
          attributes: {
            ...(version ? { version, changed: changed.join(",") } : {}),
            ...(describes ? { description: "changed" } : {}),
          },
        },
        tx,
      );
    });
    return this.describe(profileId);
  }

  /** A new profile whose v1 is a version of another. */
  async copy(
    principal: Principal,
    profileId: string,
    request: CopyProfileRequest,
  ): Promise<Profile> {
    const source = await this.row(profileId);
    const version = request.version
      ? await this.prisma.profileVersion.findUnique({
          where: {
            profileId_version: { profileId, version: request.version },
          },
          include: VERSION_RULES,
        })
      : undefined;
    if (request.version && !version) {
      throw new NotFoundException(
        `The ${profileId} profile has no version ${request.version}`,
      );
    }
    const settings = toSettings(version ?? source);
    await this.prisma.$transaction(async (tx) => {
      if (await tx.profile.findUnique({ where: { id: request.id } })) {
        throw new ConflictException(
          `A profile named ${request.id} already exists`,
        );
      }
      await tx.profile.create({
        data: {
          id: request.id,
          description: request.description ?? source.description,
          directOnly: source.directOnly,
        },
      });
      await this.writeVersion(tx, principal, request.id, 1, settings);
      await this.audit.record(
        {
          kind: AuditKind.ProfileCreated,
          principal,
          subjectType: "profile",
          subjectId: request.id,
          attributes: {
            version: 1,
            copiedFrom: profileId,
            copiedVersion: version?.version ?? source.version,
          },
        },
        tx,
      );
    });
    return this.describe(request.id);
  }

  /** Nothing new may choose it; what was issued under it renews. */
  async deactivate(principal: Principal, profileId: string): Promise<Profile> {
    return this.setActive(principal, profileId, false);
  }

  async reactivate(principal: Principal, profileId: string): Promise<Profile> {
    return this.setActive(principal, profileId, true);
  }

  /**
   * Moves chosen certificates' enrollments to a version of their profile:
   * their next renewal uses it (ADR 0034).
   */
  async moveEnrollments(
    principal: Principal,
    profileId: string,
    request: MoveProfileEnrollmentsRequest,
  ): Promise<number> {
    await this.row(profileId);
    const target = await this.prisma.profileVersion.findUnique({
      where: { profileId_version: { profileId, version: request.version } },
    });
    if (!target) {
      throw new NotFoundException(
        `The ${profileId} profile has no version ${request.version}`,
      );
    }
    const certificates = await this.prisma.certificate.findMany({
      where: { id: { in: request.certificateIds } },
      select: { id: true, profileId: true, enrollmentId: true },
    });
    const missing = request.certificateIds.filter(
      (id) => !certificates.some((c) => c.id === id),
    );
    if (missing.length) {
      throw new NotFoundException(`No certificate ${missing.join(", ")}`);
    }
    const foreign = certificates.filter(
      (c) => c.profileId !== profileId || !c.enrollmentId,
    );
    if (foreign.length) {
      throw new UnprocessableEntityException(
        `Not issued under the ${profileId} profile: ${foreign.map((c) => c.id).join(", ")}`,
      );
    }
    const enrollmentIds = [
      ...new Set(certificates.map((c) => c.enrollmentId!)),
    ];
    return this.prisma.$transaction(async (tx) => {
      const moved = await tx.enrollment.updateMany({
        where: {
          id: { in: enrollmentIds },
          profileVersionId: { not: target.id },
        },
        data: { profileVersionId: target.id },
      });
      await this.audit.record(
        {
          kind: AuditKind.ProfileEnrollmentsMoved,
          principal,
          subjectType: "profile",
          subjectId: profileId,
          attributes: {
            version: request.version,
            moved: moved.count,
            certificateIds: request.certificateIds.join(","),
          },
        },
        tx,
      );
      return moved.count;
    });
  }

  private async setActive(
    principal: Principal,
    profileId: string,
    active: boolean,
  ): Promise<Profile> {
    const profile = await this.row(profileId);
    if (!profile.deactivatedAt === active) return this.describe(profileId);
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profileId },
        data: { deactivatedAt: active ? null : new Date() },
      });
      await this.audit.record(
        {
          kind: active
            ? AuditKind.ProfileReactivated
            : AuditKind.ProfileDeactivated,
          principal,
          subjectType: "profile",
          subjectId: profileId,
          attributes: {},
        },
        tx,
      );
    });
    return this.describe(profileId);
  }

  private async writeVersion(
    tx: Prisma.TransactionClient,
    principal: Principal,
    profileId: string,
    version: number,
    settings: ProfileSettings,
  ): Promise<void> {
    await tx.profileVersion.create({
      data: {
        profileId,
        version,
        issuerId: settings.issuerId ?? null,
        issuerPurpose: settings.issuerPurpose,
        keyAlgorithm: KEY_ALGORITHM_ROWS[settings.keyAlgorithm],
        validityDays: settings.validityDays,
        renewAtDays: settings.renewAtDays,
        maxKeyAgeDays: settings.maxKeyAgeDays,
        allowCsr: settings.allowCsr,
        allowGenerated: settings.allowGenerated,
        legacyExport: settings.legacyExport,
        requireSan: settings.requireSan,
        escrow: settings.escrow,
        escrowOverridable: settings.escrowOverridable,
        extensions: settings.extensions,
        createdBy: principal.id,
        keyUsages: { create: settings.keyUsages.map((usage) => ({ usage })) },
        extendedKeyUsages: {
          create: settings.extendedKeyUsages.map((oid) => ({ oid })),
        },
        nameTypes: { create: settings.nameTypes.map((type) => ({ type })) },
      },
    });
  }

  /**
   * What a version's settings must be, together: a way to enrol, renewal
   * before expiry, a pinned issuer that exists and is of its purpose, and
   * names to require if it requires one.
   */
  private async checkSettings(settings: ProfileSettings): Promise<void> {
    const problems: string[] = [];
    if (!settings.allowCsr && !settings.allowGenerated) {
      problems.push("it allows neither a CSR nor a generated key");
    }
    if (settings.renewAtDays >= settings.validityDays) {
      problems.push(
        `it renews at ${settings.renewAtDays} days, not before its ${settings.validityDays}-day validity ends`,
      );
    }
    if (settings.requireSan && settings.nameTypes.length === 0) {
      problems.push("it requires a name but allows no name type");
    }
    if (settings.issuerId) {
      const issuer = await this.prisma.issuer.findUnique({
        where: { id: settings.issuerId },
      });
      if (!issuer) {
        throw new NotFoundException(
          `Issuer with id ${settings.issuerId} not found`,
        );
      }
      if (issuer.purpose !== settings.issuerPurpose) {
        problems.push(
          `its issuer ${issuer.id} is a ${issuer.purpose ?? "purposeless"} CA, not ${settings.issuerPurpose}`,
        );
      }
    }
    if (problems.length) {
      throw new UnprocessableEntityException(
        `The profile cannot be saved: ${problems.join("; ")}`,
      );
    }
  }
}

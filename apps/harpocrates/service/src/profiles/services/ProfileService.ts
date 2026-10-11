import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { NamePresence, Prisma, UsageState } from "../../store/prisma";
import { customExtensionProblem, subtreeProblem } from "../rules";
import { attributeOid } from "../subjectAttributes";
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
  "minNames",
  "escrow",
  "escrowOverridable",
  "extensions",
  "keyUsages",
  "extendedKeyUsages",
  "names",
  "namePolicy",
  "subjectAttributes",
  "keyAlgorithms",
  "csrSignatureHashes",
  "signatureHash",
  "rsaPadding",
  "subjectKeyIdentifier",
  "authorityKeyIdentifier",
  "basicConstraints",
  "includeCrlDistribution",
  "includeCaIssuers",
  "includeIssuerAltName",
  "policies",
  "customExtensions",
];

/** The settings whose order counts: a certificate lists them as given. */
const ORDERED: (keyof ProfileSettings)[] = ["policies"];

/** A value as compared: lists as sets, objects without empty fields. */
const canonical = (value: unknown): string =>
  JSON.stringify(
    Array.isArray(value)
      ? value.map((v) => canonical(v)).sort()
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .sort(([a], [b]) => a.localeCompare(b)),
          )
        : (value ?? null),
  );

/** Two settings' values the same. */
const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

/** Two values of a setting the same, in order where its order counts. */
const sameSetting = (
  key: keyof ProfileSettings,
  a: unknown,
  b: unknown,
): boolean =>
  ORDERED.includes(key) && Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => same(v, b[i]))
    : same(a, b);

/** A version's settings as it keeps them: excluded usages and names unlisted. */
const stored = (settings: ProfileSettings): ProfileSettings => ({
  ...settings,
  keyUsages: settings.keyUsages.filter((u) => u.state !== "excluded"),
  extendedKeyUsages: settings.extendedKeyUsages.filter(
    (u) => u.state !== "excluded",
  ),
  names: settings.names.filter((n) => n.presence !== "excluded"),
});

/**
 * What a version's rules must be, together (ADR 0034): every attribute
 * known and ruled on once, its default fitting its own pattern, a locked
 * one defaulted; names to give if it needs some; well-formed subtrees;
 * each usage listed once; its default key type among those it allows; and
 * key encipherment forced only where an RSA key may be had.
 */
const ruleProblems = (settings: ProfileSettings): string[] => {
  const problems: string[] = [];
  const oids = new Set<string>();
  for (const a of settings.subjectAttributes) {
    const oid = attributeOid(a.attribute);
    if (!oid) {
      problems.push(`${a.attribute} is not a subject attribute`);
      continue;
    }
    if (oids.has(oid)) problems.push(`${a.attribute} is ruled on twice`);
    oids.add(oid);
    if (a.locked && !a.defaultValue) {
      problems.push(`${a.attribute} is locked with no value to hold`);
    }
    if (a.pattern) {
      try {
        const pattern = new RegExp(`^(?:${a.pattern})$`);
        if (a.defaultValue && !pattern.test(a.defaultValue)) {
          problems.push(
            `${a.attribute}'s default "${a.defaultValue}" does not match its own pattern`,
          );
        }
      } catch {
        problems.push(`${a.attribute}'s pattern is not a regular expression`);
      }
    }
  }
  const named = settings.names.filter((n) => n.presence !== "excluded");
  if (
    new Set(settings.names.map((n) => n.type)).size !== settings.names.length
  ) {
    problems.push("a name type is listed twice");
  }
  if (settings.minNames > 0 && named.length === 0) {
    problems.push(
      `it needs ${settings.minNames} name${settings.minNames === 1 ? "" : "s"} but allows no name type`,
    );
  }
  for (const p of settings.namePolicy) {
    const problem = subtreeProblem(p.type, p.value.trim());
    if (problem) problems.push(problem);
  }
  const listedTwice = (values: string[]) =>
    values.filter((v, i) => values.indexOf(v) !== i);
  for (const twice of [
    ...listedTwice(settings.keyUsages.map((u) => u.usage)),
    ...listedTwice(settings.extendedKeyUsages.map((u) => u.oid)),
  ]) {
    problems.push(`${twice} is listed twice`);
  }
  if (
    settings.keyAlgorithms.length &&
    !settings.keyAlgorithms.includes(settings.keyAlgorithm)
  ) {
    problems.push(
      `its default key type ${settings.keyAlgorithm} is not among those it allows`,
    );
  }
  for (const twice of listedTwice(settings.policies.map((p) => p.oid))) {
    problems.push(`the policy ${twice} is listed twice`);
  }
  for (const p of settings.policies) {
    if (p.cpsUri && !/^https?:\/\/\S+$/.test(p.cpsUri)) {
      problems.push(`${p.oid}'s CPS URI ${p.cpsUri} is not an http(s) URL`);
    }
  }
  for (const twice of listedTwice(
    settings.customExtensions.map((e) => e.oid),
  )) {
    problems.push(`the extension ${twice} is listed twice`);
  }
  for (const e of settings.customExtensions) {
    const problem = customExtensionProblem(e.oid, e.value);
    if (problem) problems.push(problem);
  }
  if (settings.extensions === "minimal") {
    const extra = [
      settings.policies.length && "certificate policies",
      settings.customExtensions.length && "custom extensions",
      settings.includeIssuerAltName && "the issuer's alternative names",
    ].filter(Boolean);
    if (extra.length) {
      problems.push(
        `minimal extensions carry only the key identifiers, not ${extra.join(", ")}`,
      );
    }
  }
  const forced = (usage: string) =>
    settings.keyUsages.some((u) => u.usage === usage && u.state === "forced");
  if (
    forced("key_encipherment") &&
    settings.keyAlgorithms.length &&
    !settings.keyAlgorithms.some((k) => k.startsWith("RSA-"))
  ) {
    problems.push(
      "it forces key encipherment, which only an RSA key can do, but allows no RSA key",
    );
  }
  return problems;
};

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
    const merged = { ...current } as ProfileSettings;
    for (const key of SETTINGS) {
      if (given[key] !== undefined) {
        (merged as unknown as Record<string, unknown>)[key] = given[key];
      }
    }
    // Compared as it would be kept: excluded usages and names unlisted.
    const next = stored(merged);
    const changed = SETTINGS.filter(
      (key) => !sameSetting(key, current[key], next[key]),
    );
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
    const kept = stored(settings);
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
        minNames: settings.minNames,
        escrow: settings.escrow,
        escrowOverridable: settings.escrowOverridable,
        extensions: settings.extensions,
        signatureHash: settings.signatureHash,
        rsaPadding: settings.rsaPadding,
        subjectKeyIdentifier: settings.subjectKeyIdentifier,
        authorityKeyIdentifier: settings.authorityKeyIdentifier,
        basicConstraints: settings.basicConstraints,
        includeCrlDistribution: settings.includeCrlDistribution,
        includeCaIssuers: settings.includeCaIssuers,
        includeIssuerAltName: settings.includeIssuerAltName,
        createdBy: principal.id,
        keyUsages: {
          create: kept.keyUsages.map(({ usage, state }) => ({
            usage,
            state: state as UsageState,
          })),
        },
        extendedKeyUsages: {
          create: kept.extendedKeyUsages.map(({ oid, state }) => ({
            oid,
            state: state as UsageState,
          })),
        },
        nameTypes: {
          create: kept.names.map(({ type, presence }) => ({
            type,
            presence: presence as NamePresence,
          })),
        },
        namePolicies: {
          create: kept.namePolicy.map(({ type, kind, value }) => ({
            type,
            kind,
            value: value.trim(),
          })),
        },
        subjectAttributes: {
          create: kept.subjectAttributes.map((a) => ({
            oid: attributeOid(a.attribute)!,
            presence: a.presence,
            defaultValue: a.defaultValue || null,
            locked: a.locked,
            pattern: a.pattern || null,
            maxCount: a.maxCount,
          })),
        },
        keyAlgorithms: {
          create: kept.keyAlgorithms.map((algorithm) => ({
            algorithm: KEY_ALGORITHM_ROWS[algorithm],
          })),
        },
        csrHashes: {
          create: kept.csrSignatureHashes.map((hash) => ({ hash })),
        },
        policies: {
          create: kept.policies.map((p, position) => ({
            position,
            oid: p.oid,
            cpsUri: p.cpsUri || null,
            userNotice: p.userNotice || null,
          })),
        },
        customExtensions: {
          create: kept.customExtensions.map((e) => ({
            oid: e.oid,
            critical: e.critical,
            value: Buffer.from(e.value, "base64"),
          })),
        },
      },
    });
  }

  /**
   * Why a version's settings would not be saved: no way to enrol, renewal
   * not before expiry, a pinned issuer missing or of another purpose, and
   * its rules not holding together. None, they would be.
   */
  async settingsProblems(settings: ProfileSettings): Promise<string[]> {
    const problems: string[] = [];
    if (!settings.allowCsr && !settings.allowGenerated) {
      problems.push("it allows neither a CSR nor a generated key");
    }
    if (settings.renewAtDays >= settings.validityDays) {
      problems.push(
        `it renews at ${settings.renewAtDays} days, not before its ${settings.validityDays}-day validity ends`,
      );
    }
    problems.push(...ruleProblems(settings));
    if (settings.issuerId) {
      const issuer = await this.prisma.issuer.findUnique({
        where: { id: settings.issuerId },
      });
      if (!issuer) {
        problems.push(`there is no CA ${settings.issuerId}`);
      } else if (issuer.purpose !== settings.issuerPurpose) {
        problems.push(
          `its issuer ${issuer.id} is a ${issuer.purpose ?? "purposeless"} CA, not ${settings.issuerPurpose}`,
        );
      }
    }
    return problems;
  }

  /** The settings as `settingsProblems` reads them, or why not (422). */
  private async checkSettings(settings: ProfileSettings): Promise<void> {
    if (
      settings.issuerId &&
      !(await this.prisma.issuer.findUnique({
        where: { id: settings.issuerId },
      }))
    ) {
      throw new NotFoundException(
        `Issuer with id ${settings.issuerId} not found`,
      );
    }
    const problems = await this.settingsProblems(settings);
    if (problems.length) {
      throw new UnprocessableEntityException(
        `The profile cannot be saved: ${problems.join("; ")}`,
      );
    }
  }
}

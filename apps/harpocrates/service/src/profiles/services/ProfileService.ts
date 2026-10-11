import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import type { Profile, UpdateProfileRequest } from "../../model/profiles";
import { PrismaService } from "../../store/PrismaService";
import {
  asProfileWithRules,
  PROFILE_WITH_VERSION,
  type ProfileWithRules,
  toDomainObject,
} from "../converters/ProfileConverter";

/**
 * Profiles (ADR 0020, 0034): each read as its latest version, which new
 * certificates take; a renewal reads the version it was issued under.
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

  async update(
    principal: Principal,
    profileId: string,
    request: UpdateProfileRequest,
  ): Promise<Profile> {
    const latest = await this.row(profileId);
    if (request.issuerId) {
      const issuer = await this.prisma.issuer.findUnique({
        where: { id: request.issuerId },
      });
      if (!issuer) {
        throw new NotFoundException(
          `Issuer with id ${request.issuerId} not found`,
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      // The pin is changed where it was, on the latest version, until
      // editing makes versions of its own (ADR 0034, phase 10 step 2).
      await tx.profileVersion.update({
        where: { id: latest.versionId },
        data: { issuerId: request.issuerId ?? null },
      });
      await this.audit.record(
        {
          kind: AuditKind.ProfileUpdated,
          principal,
          subjectType: "profile",
          subjectId: profileId,
          attributes: { issuerId: request.issuerId ?? "(unpinned)" },
        },
        tx,
      );
    });
    return this.describe(profileId);
  }
}

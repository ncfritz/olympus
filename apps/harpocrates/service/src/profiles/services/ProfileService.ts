import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import type { Profile, UpdateProfileRequest } from "../../model/profiles";
import { PrismaService } from "../../store/PrismaService";
import {
  PROFILE_RULES,
  type ProfileWithRules,
  toDomainObject,
} from "../converters/ProfileConverter";

/** Profiles (ADR 0020): seeded by migration; only the issuer pin changes. */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<Profile[]> {
    const rows = await this.prisma.profile.findMany({
      include: PROFILE_RULES,
      orderBy: { id: "asc" },
    });
    return rows.map(toDomainObject);
  }

  async describe(profileId: string): Promise<Profile> {
    return toDomainObject(await this.row(profileId));
  }

  async row(profileId: string): Promise<ProfileWithRules> {
    const row = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: PROFILE_RULES,
    });
    if (!row) {
      throw new NotFoundException(`Profile with id ${profileId} not found`);
    }
    return row;
  }

  async update(
    principal: Principal,
    profileId: string,
    request: UpdateProfileRequest,
  ): Promise<Profile> {
    await this.row(profileId);
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
      await tx.profile.update({
        where: { id: profileId },
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

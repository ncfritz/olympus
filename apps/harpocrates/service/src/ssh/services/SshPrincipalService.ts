import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import type { SshPrincipalMapping } from "../../model/ssh";
import { PrismaService } from "../../store/PrismaService";
import { toMapping } from "../converters/SshConverter";

const EMAIL = /^[^@\s]+@[^@\s]+$/;

/** An identity as the mapping keys it: its email, lower case. */
export const identityKey = (email: string): string =>
  email.trim().toLowerCase();

/**
 * Who may log in as whom (ADR 0035): an admin maps each Olympus identity
 * to its principals; a user certificate carries no others.
 */
@Injectable()
export class SshPrincipalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SshPrincipalMapping[]> {
    const rows = await this.prisma.sshPrincipalMapping.findMany({
      orderBy: [{ identity: "asc" }, { id: "asc" }],
    });
    const byIdentity = new Map<string, typeof rows>();
    for (const row of rows) {
      byIdentity.set(row.identity, [
        ...(byIdentity.get(row.identity) ?? []),
        row,
      ]);
    }
    return [...byIdentity.values()].map(toMapping);
  }

  /** An identity's principals; none when it is not mapped. */
  async principalsOf(email: string): Promise<string[]> {
    const rows = await this.prisma.sshPrincipalMapping.findMany({
      where: { identity: identityKey(email) },
      orderBy: { id: "asc" },
    });
    return rows.map((r) => r.principal);
  }

  async describe(email: string): Promise<SshPrincipalMapping> {
    const rows = await this.prisma.sshPrincipalMapping.findMany({
      where: { identity: identityKey(email) },
    });
    if (!rows.length) {
      throw new NotFoundException(`${email} has no SSH principals`);
    }
    return toMapping(rows);
  }

  /** Replaces an identity's principals; none removes its mapping. */
  async set(
    principal: Principal,
    email: string,
    principals: string[],
  ): Promise<SshPrincipalMapping | undefined> {
    const identity = identityKey(email);
    if (!EMAIL.test(identity)) {
      throw new BadRequestException(`${email} is not an email address`);
    }
    const before = await this.principalsOf(identity);
    await this.prisma.$transaction(async (tx) => {
      await tx.sshPrincipalMapping.deleteMany({
        where: { identity, principal: { notIn: principals } },
      });
      for (const name of principals.filter((p) => !before.includes(p))) {
        await tx.sshPrincipalMapping.create({
          data: { identity, principal: name },
        });
      }
      await this.audit.record(
        {
          kind: AuditKind.SshPrincipalsSet,
          principal,
          subjectType: "ssh-identity",
          subjectId: identity,
          attributes: {
            before: before.join(","),
            after: principals.join(","),
          },
        },
        tx,
      );
    });
    return principals.length ? this.describe(identity) : undefined;
  }
}

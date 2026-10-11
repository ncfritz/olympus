import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import type {
  AcmeCredential,
  CreateAcmeCredentialRequest,
  CreateAcmeCredentialResponse,
} from "../../model/acme";
import { PrismaService } from "../../store/PrismaService";
import {
  CREDENTIAL_INCLUDE,
  toAcmeCredential,
} from "../converters/AcmeCredentialConverter";
import { dnsNameProblem, normaliseDnsName } from "../namePolicy";
import { AcmeUrls } from "./AcmeUrls";

/**
 * External Account Binding credentials (ADR 0020, ACME): made by an admin
 * for one ACME client, with the names its account may request. The HMAC
 * key is shown once and erased when an account binds it, so a credential
 * registers one account; revoking it revokes that account.
 */
@Injectable()
export class AcmeCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly urls: AcmeUrls,
  ) {}

  async list(): Promise<AcmeCredential[]> {
    const rows = await this.prisma.acmeEabCredential.findMany({
      include: CREDENTIAL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toAcmeCredential);
  }

  async create(
    principal: Principal,
    request: CreateAcmeCredentialRequest,
  ): Promise<CreateAcmeCredentialResponse> {
    const rules = [
      ...(request.names.exact ?? []).map((value) => ({
        kind: "exact" as const,
        value: normaliseDnsName(value),
      })),
      ...(request.names.subtrees ?? []).map((value) => ({
        kind: "subtree" as const,
        value: normaliseDnsName(value),
      })),
    ];
    if (rules.length === 0) {
      throw new BadRequestException(
        "A credential needs at least one name or subtree its account may request",
      );
    }
    const problems = rules.flatMap((rule) => dnsNameProblem(rule.value) ?? []);
    if (problems.length) throw new BadRequestException(problems.join("; "));

    const id = randomBytes(16).toString("base64url");
    const hmacKey = randomBytes(32).toString("base64url");
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.acmeEabCredential.create({
        data: {
          id,
          label: request.label.trim(),
          hmacKey,
          principal: principal.id,
          names: { createMany: { data: rules, skipDuplicates: true } },
        },
        include: CREDENTIAL_INCLUDE,
      });
      await this.audit.record(
        {
          kind: AuditKind.AcmeCredentialCreated,
          principal,
          subjectType: "acme-credential",
          subjectId: id,
          attributes: {
            label: created.label,
            names: rules.map((r) => `${r.kind}:${r.value}`).join(" "),
          },
        },
        tx,
      );
      return created;
    });
    return {
      credential: toAcmeCredential(row),
      hmacKey,
      directoryUrl: this.urls.directory(),
    };
  }

  /** Revokes a credential: unused, it binds nothing; bound, its account is revoked. */
  async revoke(principal: Principal, id: string): Promise<AcmeCredential> {
    const current = await this.prisma.acmeEabCredential.findUnique({
      where: { id },
      include: CREDENTIAL_INCLUDE,
    });
    if (!current) {
      throw new NotFoundException(`ACME credential with id ${id} not found`);
    }
    if (current.revokedAt) {
      throw new ConflictException("The credential is already revoked");
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (current.account) {
        await tx.acmeAccount.update({
          where: { id: current.account.id },
          data: { status: "revoked" },
        });
      }
      const revoked = await tx.acmeEabCredential.update({
        where: { id },
        data: { revokedAt: new Date(), hmacKey: null },
        include: CREDENTIAL_INCLUDE,
      });
      await this.audit.record(
        {
          kind: AuditKind.AcmeCredentialRevoked,
          principal,
          subjectType: "acme-credential",
          subjectId: id,
          attributes: { accountId: current.account?.id },
        },
        tx,
      );
      return revoked;
    });
    return toAcmeCredential(row);
  }
}

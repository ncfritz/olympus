import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "crypto";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { acmePrincipal } from "../../auth/principal";
import type {
  AcmeAccount,
  AcmeAuthorization,
  AcmeChallenge,
  AcmeOrder,
} from "../../store/prisma";
import { PrismaService } from "../../store/PrismaService";
import { ACME_ERROR, Acme, type AcmeProblemDocument } from "../AcmeProblem";
import { dnsNameProblem, normaliseDnsName, permits } from "../namePolicy";
import {
  AcmeChallengeValidator,
  type ChallengeKind,
} from "./AcmeChallengeValidator";
import type { VerifiedRequest } from "./AcmeJwsService";
import { AcmeUrls } from "./AcmeUrls";

const DAY = 24 * 60 * 60 * 1000;
/** How long an order, and its authorizations, may take. */
const ORDER_LIFETIME_MS = 7 * DAY;
/** How many names one order may ask for. */
const MAX_IDENTIFIERS = 20;
/** A validation is tried this many times, this far apart, before it fails. */
const ATTEMPTS = 3;
const ATTEMPT_GAP_MS = 2_000;
/** A validation the service lost (a restart) is started again after this. */
const STALE_MS = 2 * 60_000;

type AuthorizationWithChallenges = AcmeAuthorization & {
  challenges: AcmeChallenge[];
};
type OrderWithAuthorizations = AcmeOrder & {
  authorizations: AuthorizationWithChallenges[];
};

const CHALLENGE_TYPE: Record<AcmeChallenge["type"], ChallengeKind> = {
  http_01: "http-01",
  tls_alpn_01: "tls-alpn-01",
};

const errorOf = (row: {
  errorType: string | null;
  errorDetail: string | null;
}): AcmeProblemDocument | undefined =>
  row.errorType
    ? {
        type: row.errorType.startsWith("urn:")
          ? row.errorType
          : `${ACME_ERROR}${row.errorType}`,
        detail: row.errorDetail ?? "",
        status: 403,
      }
    : undefined;

/**
 * Orders, authorizations and challenges (RFC 8555 §7.4–7.5): an order is
 * checked against its account's name policy before anything is created
 * (ADR 0020, ACME); each name gets an authorization with an http-01 and
 * a tls-alpn-01 challenge, validated in the background once the client
 * says it is ready.
 */
@Injectable()
export class AcmeOrderService {
  private readonly logger = new Logger(AcmeOrderService.name);
  private readonly validating = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly urls: AcmeUrls,
    private readonly validator: AcmeChallengeValidator,
  ) {}

  /** new-order: the names, checked; an authorization each. */
  async newOrder(
    request: VerifiedRequest,
  ): Promise<{ location: string; body: Record<string, unknown> }> {
    const account = request.account!;
    const payload = request.payload as
      | { identifiers?: unknown; notBefore?: unknown; notAfter?: unknown }
      | undefined;
    if (!payload || !Array.isArray(payload.identifiers)) {
      throw Acme.malformed("An order lists its identifiers");
    }
    if (payload.notBefore !== undefined || payload.notAfter !== undefined) {
      throw Acme.malformed(
        "notBefore and notAfter are not taken: the profile sets the validity",
      );
    }
    const identifiers = payload.identifiers as unknown[];
    if (identifiers.length === 0 || identifiers.length > MAX_IDENTIFIERS) {
      throw Acme.malformed(
        `An order names 1 to ${MAX_IDENTIFIERS} identifiers`,
      );
    }
    const policy = await this.prisma.acmeNamePolicy.findMany({
      where: { credentialId: account.credentialId },
    });
    const names: string[] = [];
    const subproblems: NonNullable<AcmeProblemDocument["subproblems"]> = [];
    for (const raw of identifiers) {
      const identifier = raw as { type?: unknown; value?: unknown };
      const shown = {
        type: String(identifier?.type),
        value: String(identifier?.value),
      };
      if (identifier?.type !== "dns" || typeof identifier.value !== "string") {
        subproblems.push({
          ...Acme.unsupportedIdentifier(
            `${shown.type}: only dns identifiers`,
          ).document(),
          identifier: shown,
        });
        continue;
      }
      const name = normaliseDnsName(identifier.value);
      const problem = dnsNameProblem(name);
      if (problem) {
        subproblems.push({
          ...Acme.rejectedIdentifier(problem).document(),
          identifier: { type: "dns", value: name },
        });
      } else if (!permits(policy, name)) {
        subproblems.push({
          ...Acme.rejectedIdentifier(
            `${name} is not among the names this account may request`,
          ).document(),
          identifier: { type: "dns", value: name },
        });
      } else if (!names.includes(name)) {
        names.push(name);
      }
    }
    if (subproblems.length) {
      throw Acme.rejectedIdentifier(
        subproblems.length === 1
          ? subproblems[0].detail
          : `${subproblems.length} identifiers are refused`,
        { subproblems },
      );
    }

    const expiresAt = new Date(Date.now() + ORDER_LIFETIME_MS);
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.acmeOrder.create({
        data: {
          accountId: account.id,
          expiresAt,
          authorizations: {
            create: names.map((identifier) => ({
              identifier,
              expiresAt,
              challenges: {
                create: (["http_01", "tls_alpn_01"] as const).map((type) => ({
                  type,
                  token: randomBytes(32).toString("base64url"),
                })),
              },
            })),
          },
        },
        include: { authorizations: { include: { challenges: true } } },
      });
      await this.audit.record(
        {
          kind: AuditKind.AcmeOrderCreated,
          principal: acmePrincipal(account.id),
          subjectType: "acme-order",
          subjectId: created.id,
          attributes: { names: names.join(" ") },
        },
        tx,
      );
      return created;
    });
    return {
      location: this.urls.order(order.id),
      body: this.orderObject(order),
    };
  }

  /** An order, as its account sees it (POST-as-GET). */
  async order(
    orderId: string,
    request: VerifiedRequest,
  ): Promise<Record<string, unknown>> {
    return this.orderObject(await this.ownOrder(orderId, request.account!));
  }

  /** The account's orders (RFC 8555 §7.1.2.1), newest first. */
  async orders(accountId: string, request: VerifiedRequest): Promise<string[]> {
    if (request.account!.id !== accountId) {
      throw Acme.unauthorized("An account lists only its own orders");
    }
    const rows = await this.prisma.acmeOrder.findMany({
      where: { accountId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return rows.map((row) => this.urls.order(row.id));
  }

  /** An authorization (POST-as-GET), or its deactivation (§7.5.2). */
  async authorization(
    authorizationId: string,
    request: VerifiedRequest,
  ): Promise<Record<string, unknown>> {
    let authorization = await this.ownAuthorization(
      authorizationId,
      request.account!,
    );
    const payload = request.payload as { status?: unknown } | undefined;
    if (payload && Object.keys(payload).length > 0) {
      if (payload.status !== "deactivated") {
        throw Acme.malformed("An authorization may only be deactivated");
      }
      if (!["pending", "valid"].includes(authorization.status)) {
        throw Acme.malformed(`The authorization is ${authorization.status}`);
      }
      await this.prisma.acmeAuthorization.update({
        where: { id: authorizationId },
        data: { status: "deactivated" },
      });
      await this.settleOrder(authorization.orderId);
      authorization = await this.ownAuthorization(
        authorizationId,
        request.account!,
      );
    }
    this.restartLost(authorization);
    return this.authorizationObject(authorization);
  }

  /**
   * A challenge (POST-as-GET), or the client saying it is ready (a POST
   * of {}): validation starts, and the answer says it is processing.
   */
  async challenge(
    challengeId: string,
    request: VerifiedRequest,
  ): Promise<{ body: Record<string, unknown>; up: string }> {
    let challenge = await this.ownChallenge(challengeId, request.account!);
    if (request.payload !== undefined && challenge.status === "pending") {
      if (challenge.authorization.status !== "pending") {
        throw Acme.malformed(
          `The authorization is ${challenge.authorization.status}`,
        );
      }
      challenge = {
        ...challenge,
        ...(await this.prisma.acmeChallenge.update({
          where: { id: challengeId },
          data: { status: "processing" },
        })),
      };
      this.startValidation(challengeId);
    }
    return {
      body: this.challengeObject(challenge),
      up: this.urls.authorization(challenge.authorizationId),
    };
  }

  // ---- validation

  private startValidation(challengeId: string): void {
    if (this.validating.has(challengeId)) return;
    this.validating.add(challengeId);
    void this.validate(challengeId)
      .catch((error: unknown) =>
        this.logger.error(
          `Validating challenge ${challengeId} failed: ${String(error)}`,
        ),
      )
      .finally(() => this.validating.delete(challengeId));
  }

  /** A challenge left processing by a restart is validated again. */
  private restartLost(authorization: AuthorizationWithChallenges): void {
    for (const challenge of authorization.challenges) {
      if (
        challenge.status === "processing" &&
        Date.now() - challenge.updatedAt.getTime() > STALE_MS
      ) {
        this.startValidation(challenge.id);
      }
    }
  }

  private async validate(challengeId: string): Promise<void> {
    const challenge = await this.prisma.acmeChallenge.findUniqueOrThrow({
      where: { id: challengeId },
      include: {
        authorization: {
          include: {
            order: { include: { account: true } },
          },
        },
      },
    });
    const { authorization } = challenge;
    const account = authorization.order.account;
    const keyAuthorization = `${challenge.token}.${account.keyThumbprint}`;
    const kind = CHALLENGE_TYPE[challenge.type];
    let outcome = await this.validator.validate(
      kind,
      authorization.identifier,
      challenge.token,
      keyAuthorization,
    );
    for (let attempt = 1; !outcome.valid && attempt < ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, ATTEMPT_GAP_MS));
      outcome = await this.validator.validate(
        kind,
        authorization.identifier,
        challenge.token,
        keyAuthorization,
      );
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.acmeChallenge.update({
        where: { id: challengeId },
        data: outcome.valid
          ? { status: "valid", validatedAt: now }
          : {
              status: "invalid",
              errorType: outcome.type,
              errorDetail: outcome.detail,
            },
      });
      await tx.acmeAuthorization.updateMany({
        where: { id: authorization.id, status: "pending" },
        data: { status: outcome.valid ? "valid" : "invalid" },
      });
      await this.audit.record(
        {
          kind: outcome.valid
            ? AuditKind.AcmeChallengeValid
            : AuditKind.AcmeChallengeInvalid,
          principal: acmePrincipal(account.id),
          subjectType: "acme-order",
          subjectId: authorization.orderId,
          reason: outcome.valid ? undefined : outcome.detail,
          attributes: { name: authorization.identifier, type: kind },
        },
        tx,
      );
    });
    if (!outcome.valid) {
      this.logger.warn(
        `${kind} for ${authorization.identifier} failed: ${outcome.detail}`,
      );
    }
    await this.settleOrder(authorization.orderId);
  }

  /**
   * An order's status from its authorizations: ready when all are valid,
   * invalid when one is not, with that one's error.
   */
  private async settleOrder(orderId: string): Promise<void> {
    const order = await this.prisma.acmeOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { authorizations: { include: { challenges: true } } },
    });
    if (order.status !== "pending") return;
    const failed = order.authorizations.find((a) =>
      ["invalid", "deactivated", "expired", "revoked"].includes(a.status),
    );
    if (failed) {
      const cause = failed.challenges.find((c) => c.status === "invalid");
      await this.prisma.acmeOrder.update({
        where: { id: orderId },
        data: {
          status: "invalid",
          errorType: cause?.errorType ?? "unauthorized",
          errorDetail:
            cause?.errorDetail ??
            `The authorization for ${failed.identifier} is ${failed.status}`,
        },
      });
    } else if (order.authorizations.every((a) => a.status === "valid")) {
      await this.prisma.acmeOrder.update({
        where: { id: orderId },
        data: { status: "ready" },
      });
    }
  }

  // ---- reading, as the account's own

  /** Its order, with an expired one marked so (§7.1.6). */
  async ownOrder(
    orderId: string,
    account: AcmeAccount,
  ): Promise<OrderWithAuthorizations> {
    const order = await this.prisma.acmeOrder.findUnique({
      where: { id: orderId },
      include: {
        authorizations: {
          include: { challenges: true },
          orderBy: { identifier: "asc" },
        },
      },
    });
    if (!order || order.accountId !== account.id) {
      throw Acme.malformed(`No order ${orderId} for this account`);
    }
    if (
      order.expiresAt < new Date() &&
      ["pending", "ready"].includes(order.status)
    ) {
      await this.prisma.$transaction([
        this.prisma.acmeAuthorization.updateMany({
          where: { orderId, status: "pending" },
          data: { status: "expired" },
        }),
        this.prisma.acmeOrder.update({
          where: { id: orderId },
          data: {
            status: "invalid",
            errorType: "malformed",
            errorDetail: "The order expired",
          },
        }),
      ]);
      return this.ownOrder(orderId, account);
    }
    return order;
  }

  private async ownAuthorization(
    authorizationId: string,
    account: AcmeAccount,
  ): Promise<AuthorizationWithChallenges & { orderId: string }> {
    const authorization = await this.prisma.acmeAuthorization.findUnique({
      where: { id: authorizationId },
      include: { challenges: true, order: { select: { accountId: true } } },
    });
    if (!authorization || authorization.order.accountId !== account.id) {
      throw Acme.malformed(
        `No authorization ${authorizationId} for this account`,
      );
    }
    return authorization;
  }

  private async ownChallenge(
    challengeId: string,
    account: AcmeAccount,
  ): Promise<AcmeChallenge & { authorization: AcmeAuthorization }> {
    const challenge = await this.prisma.acmeChallenge.findUnique({
      where: { id: challengeId },
      include: {
        authorization: { include: { order: { select: { accountId: true } } } },
      },
    });
    if (!challenge || challenge.authorization.order.accountId !== account.id) {
      throw Acme.malformed(`No challenge ${challengeId} for this account`);
    }
    return challenge;
  }

  // ---- the objects (RFC 8555 §7.1.3–7.1.5)

  orderObject(order: OrderWithAuthorizations): Record<string, unknown> {
    // By name, however they were asked for or read.
    const authorizations = [...order.authorizations].sort((a, b) =>
      a.identifier.localeCompare(b.identifier),
    );
    return {
      status: order.status,
      expires: order.expiresAt.toISOString(),
      identifiers: authorizations.map((a) => ({
        type: "dns",
        value: a.identifier,
      })),
      authorizations: authorizations.map((a) => this.urls.authorization(a.id)),
      finalize: this.urls.finalize(order.id),
      ...(order.certificateId
        ? { certificate: this.urls.certificate(order.certificateId) }
        : {}),
      ...(errorOf(order) ? { error: errorOf(order) } : {}),
    };
  }

  private authorizationObject(
    authorization: AuthorizationWithChallenges,
  ): Record<string, unknown> {
    return {
      identifier: { type: "dns", value: authorization.identifier },
      status: authorization.status,
      expires: authorization.expiresAt.toISOString(),
      challenges: [...authorization.challenges]
        .sort((a, b) => a.type.localeCompare(b.type))
        .map((c) => this.challengeObject(c)),
    };
  }

  private challengeObject(challenge: AcmeChallenge): Record<string, unknown> {
    return {
      type: CHALLENGE_TYPE[challenge.type],
      url: this.urls.challenge(challenge.id),
      status: challenge.status,
      token: challenge.token,
      ...(challenge.validatedAt
        ? { validated: challenge.validatedAt.toISOString() }
        : {}),
      ...(errorOf(challenge) ? { error: errorOf(challenge) } : {}),
    };
  }
}

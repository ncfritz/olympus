import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "../../store/prisma";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { type Principal, SYSTEM } from "../../auth/principal";
import { CertificateService } from "../../certificates/services/CertificateService";
import {
  deploymentFailures,
  deploymentsDone,
  targetRenewalFailures,
} from "../../metrics/pkiMetrics";
import type {
  CreateDeployTargetRequest,
  DeployTarget,
  FullDeployTarget,
  UpdateDeployTargetRequest,
} from "../../model/deployTargets";
import { PrismaService } from "../../store/PrismaService";
import {
  type DeploymentWithCertificate,
  deployTargetInclude,
  type DeployTargetWithCertificate,
  renewsAt,
  toDeployTarget,
  toFullDeployTarget,
} from "../converters/DeployTargetConverter";
import { HostPathDeployer } from "./HostPathDeployer";

/** The first retry after 30 seconds, doubling, at most every 15 minutes. */
const FIRST_RETRY_MS = 30_000;
const MAX_RETRY_MS = 15 * 60_000;

/** host:port, with a port a port can be. */
const checkEndpoint = (endpoint: string): string => {
  const port = Number(endpoint.slice(endpoint.lastIndexOf(":") + 1));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new BadRequestException(`${endpoint} has no port 1 to 65535`);
  }
  return endpoint;
};

/** How many deployments a target's description shows. */
const HISTORY = 20;

const retryAt = (deployment: DeploymentWithCertificate): Date =>
  deployment.attempts === 0 || !deployment.lastAttemptAt
    ? new Date(0)
    : new Date(
        deployment.lastAttemptAt.getTime() +
          Math.min(
            FIRST_RETRY_MS * 2 ** (deployment.attempts - 1),
            MAX_RETRY_MS,
          ),
      );

const messageOf = (error: unknown) =>
  error instanceof HttpException || error instanceof Error
    ? error.message
    : String(error);

export type DeployRun = {
  renewed: { target: string; certificateId: string }[];
  renewalsFailed: { target: string; reason: string; message: string }[];
  followed: { target: string; certificateId: string }[];
  deployed: { target: string; certificateId: string; error?: string }[];
};

/**
 * Deploy targets (ADR 0020, Renewal and delivery): a certificate installed
 * where its holder can neither renew over mutual TLS nor speak ACME. Its
 * key is generated and escrowed, so Harpocrates renews the certificate
 * when its profile says it is due, the target follows the renewal (by the
 * console, the API or the schedule), and each new certificate is
 * deployed, retried with a backoff until it is, and audited.
 */
@Injectable()
export class DeployService {
  private readonly logger = new Logger(DeployService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificateService,
    private readonly hostPath: HostPathDeployer,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<DeployTarget[]> {
    const rows = await this.prisma.deployTarget.findMany({
      include: deployTargetInclude(1),
      orderBy: { name: "asc" },
    });
    return rows.map(toDeployTarget);
  }

  async describe(targetId: string): Promise<FullDeployTarget> {
    return toFullDeployTarget(await this.row(targetId));
  }

  /** A new target, deployed at once; a failed first deployment is retried. */
  async create(
    principal: Principal,
    request: CreateDeployTargetRequest,
  ): Promise<FullDeployTarget> {
    await this.certificates.checkDeployable(request.certificateId);
    const endpoint = checkEndpoint(request.endpoint ?? `${request.name}:443`);
    let deploymentId: string;
    let targetId: string;
    try {
      ({ targetId, deploymentId } = await this.prisma.$transaction(
        async (tx) => {
          const target = await tx.deployTarget.create({
            data: {
              name: request.name,
              certificateId: request.certificateId,
              endpoint,
            },
          });
          await this.audit.record(
            {
              kind: AuditKind.DeployTargetCreated,
              principal,
              subjectType: "deploy-target",
              subjectId: target.id,
              attributes: {
                name: target.name,
                kind: target.kind,
                certificateId: target.certificateId,
                endpoint: target.endpoint,
              },
            },
            tx,
          );
          const deployment = await this.queue(
            tx,
            target.id,
            target.certificateId,
            principal,
          );
          return { targetId: target.id, deploymentId: deployment };
        },
      ));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `A deploy target named ${request.name} exists`,
        );
      }
      throw error;
    }
    await this.attempt(deploymentId);
    return this.describe(targetId);
  }

  /**
   * Points a target at another certificate (a reissue), deployed at once,
   * or at another endpoint, checked from then on.
   */
  async update(
    principal: Principal,
    targetId: string,
    request: UpdateDeployTargetRequest,
  ): Promise<FullDeployTarget> {
    if (!request.certificateId && !request.endpoint) {
      throw new BadRequestException(
        "Give the certificate or the endpoint to change",
      );
    }
    const current = await this.row(targetId);
    const certificateId =
      request.certificateId !== current.certificateId
        ? request.certificateId
        : undefined;
    const endpoint =
      request.endpoint !== undefined && request.endpoint !== current.endpoint
        ? checkEndpoint(request.endpoint)
        : undefined;
    if (certificateId) await this.certificates.checkDeployable(certificateId);
    const deploymentId = await this.prisma.$transaction(async (tx) => {
      await tx.deployTarget.update({
        where: { id: targetId },
        data: { certificateId, endpoint },
      });
      await this.audit.record(
        {
          kind: AuditKind.DeployTargetUpdated,
          principal,
          subjectType: "deploy-target",
          subjectId: targetId,
          attributes: {
            name: current.name,
            ...(certificateId
              ? { from: current.certificateId, certificateId }
              : {}),
            ...(endpoint ? { fromEndpoint: current.endpoint, endpoint } : {}),
          },
        },
        tx,
      );
      return certificateId
        ? this.queue(tx, targetId, certificateId, principal)
        : undefined;
    });
    if (deploymentId) await this.attempt(deploymentId);
    return this.describe(targetId);
  }

  /** Deploys its certificate again, now: after the files were lost, say. */
  async redeploy(
    principal: Principal,
    targetId: string,
  ): Promise<FullDeployTarget> {
    const target = await this.row(targetId);
    await this.certificates.checkDeployable(target.certificateId);
    const deploymentId = await this.prisma.$transaction((tx) =>
      this.queue(tx, targetId, target.certificateId, principal),
    );
    await this.attempt(deploymentId);
    return this.describe(targetId);
  }

  /**
   * Forgets a target. Its files stay where they are, still served: the web
   * server's configuration names them, and goes first.
   */
  async remove(principal: Principal, targetId: string): Promise<void> {
    const target = await this.row(targetId);
    await this.prisma.$transaction(async (tx) => {
      await tx.deployTarget.delete({ where: { id: targetId } });
      await this.audit.record(
        {
          kind: AuditKind.DeployTargetDeleted,
          principal,
          subjectType: "deploy-target",
          subjectId: targetId,
          attributes: {
            name: target.name,
            certificateId: target.certificateId,
          },
        },
        tx,
      );
    });
  }

  // ---- the schedule

  /**
   * Renews every target's certificate that is due. Stops at the first
   * sealed refusal: every other renewal would fail the same way.
   */
  async renewDue(
    now = new Date(),
  ): Promise<Pick<DeployRun, "renewed" | "renewalsFailed">> {
    const result: Pick<DeployRun, "renewed" | "renewalsFailed"> = {
      renewed: [],
      renewalsFailed: [],
    };
    const targets = await this.prisma.deployTarget.findMany({
      where: {
        certificate: {
          status: "valid",
          renewedBy: null,
          profileId: { not: null },
        },
      },
      include: deployTargetInclude(0),
      orderBy: { name: "asc" },
    });
    for (const target of targets) {
      if (renewsAt(target.certificate) > now) continue;
      try {
        const renewal = await this.certificates.renew(
          SYSTEM,
          target.certificateId,
          {},
        );
        result.renewed.push({ target: target.name, certificateId: renewal.id });
      } catch (error: unknown) {
        const reason =
          error instanceof ServiceUnavailableException
            ? "sealed"
            : error instanceof UnprocessableEntityException ||
                error instanceof ConflictException
              ? "refused"
              : "error";
        const message = messageOf(error);
        targetRenewalFailures.inc({ target: target.name, reason });
        result.renewalsFailed.push({ target: target.name, reason, message });
        this.logger.warn(
          `Renewing ${target.name}'s certificate failed (${reason}): ${message}`,
        );
        if (reason === "sealed") break;
      }
    }
    return result;
  }

  /**
   * Moves each target to the newest renewal of its certificate, however it
   * was renewed, and queues its deployment.
   */
  async follow(): Promise<DeployRun["followed"]> {
    const targets = await this.prisma.deployTarget.findMany({
      where: { certificate: { renewedBy: { isNot: null } } },
      orderBy: { name: "asc" },
    });
    const followed: DeployRun["followed"] = [];
    for (const target of targets) {
      let newest = target.certificateId;
      for (;;) {
        const next = await this.prisma.certificate.findUnique({
          where: { renewsId: newest },
          select: { id: true },
        });
        if (!next) break;
        newest = next.id;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.deployTarget.update({
          where: { id: target.id },
          data: { certificateId: newest },
        });
        await this.queue(tx, target.id, newest, SYSTEM);
      });
      followed.push({ target: target.name, certificateId: newest });
    }
    return followed;
  }

  /** Tries every pending deployment that is due a try. */
  async deployPending(now = new Date()): Promise<DeployRun["deployed"]> {
    const pending = await this.prisma.deployment.findMany({
      where: { status: "pending" },
      include: { certificate: { select: { serial: true } } },
      orderBy: { createdAt: "asc" },
    });
    const deployed: DeployRun["deployed"] = [];
    for (const deployment of pending) {
      if (retryAt(deployment) > now) continue;
      deployed.push(await this.attempt(deployment.id));
    }
    return deployed;
  }

  // ---- the parts

  private async row(targetId: string): Promise<DeployTargetWithCertificate> {
    const row = await this.prisma.deployTarget.findUnique({
      where: { id: targetId },
      include: deployTargetInclude(HISTORY),
    });
    if (!row) {
      throw new NotFoundException(
        `Deploy target with id ${targetId} not found`,
      );
    }
    return row;
  }

  /** A new deployment for the target; any still pending is superseded. */
  private async queue(
    tx: Prisma.TransactionClient,
    targetId: string,
    certificateId: string,
    principal: Principal,
  ): Promise<string> {
    await tx.deployment.updateMany({
      where: { targetId, status: "pending" },
      data: { status: "superseded" },
    });
    const deployment = await tx.deployment.create({
      data: { targetId, certificateId, principal: principal.id },
    });
    return deployment.id;
  }

  /** One try at one deployment, recorded either way. */
  private async attempt(
    deploymentId: string,
  ): Promise<DeployRun["deployed"][number]> {
    const deployment = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: deploymentId },
      include: {
        target: true,
        certificate: { select: { serial: true } },
      },
    });
    const { target } = deployment;
    const attemptedAt = new Date();
    try {
      const deployable = await this.certificates.exportForDeployment(
        deployment.certificateId,
        target.name,
      );
      await this.hostPath.write(target.name, deployable, {
        certificateId: deployment.certificateId,
        serial: deployment.certificate.serial,
      });
    } catch (error: unknown) {
      const message = messageOf(error);
      deploymentFailures.inc({ target: target.name });
      this.logger.warn(
        `Deploying ${deployment.certificateId} to ${target.name} failed (attempt ${deployment.attempts + 1}): ${message}`,
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.deployment.update({
          where: { id: deployment.id },
          data: {
            attempts: { increment: 1 },
            lastAttemptAt: attemptedAt,
            lastError: message,
          },
        });
        // Once per deployment: the retries are in its own record.
        if (deployment.attempts === 0) {
          await this.audit.record(
            {
              kind: AuditKind.DeploymentFailed,
              principal: SYSTEM,
              subjectType: "deploy-target",
              subjectId: target.id,
              reason: message,
              attributes: {
                name: target.name,
                certificateId: deployment.certificateId,
              },
            },
            tx,
          );
        }
      });
      return {
        target: target.name,
        certificateId: deployment.certificateId,
        error: message,
      };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "deployed",
          attempts: { increment: 1 },
          lastAttemptAt: attemptedAt,
          lastError: null,
          deployedAt: attemptedAt,
        },
      });
      await this.audit.record(
        {
          kind: AuditKind.CertificateDeployed,
          principal: SYSTEM,
          subjectType: "deploy-target",
          subjectId: target.id,
          attributes: {
            name: target.name,
            certificateId: deployment.certificateId,
            serial: deployment.certificate.serial,
            directory: this.hostPath.directoryOf(target.name),
          },
        },
        tx,
      );
    });
    deploymentsDone.inc({ target: target.name });
    this.logger.log(`Deployed ${deployment.certificateId} to ${target.name}`);
    return { target: target.name, certificateId: deployment.certificateId };
  }
}

import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import {
  deployConfig,
  type DeployConfigType,
} from "../../config/configuration";
import { certificatePem, isMustStaple, parseCertificate } from "../../pki/x509";
import type { EndpointResult } from "../../store/prisma";
import { PrismaService } from "../../store/PrismaService";
import { EndpointProbe } from "./EndpointProbe";

/**
 * How long after a deployment its endpoint is checked: nginx's watcher
 * looks every 10 seconds, then reloads.
 */
export const SETTLE_MS = 30_000;

/** How often an endpoint serving the wrong certificate is checked again. */
export const RECHECK_MS = 5 * 60_000;

/**
 * How long before a must-staple certificate's endpoint is asked again
 * when it stapled nothing: nginx fetches the response on the first
 * handshake that asks for it and staples from the next.
 */
export const STAPLE_RETRY_MS = 2_000;

export type EndpointCheck = {
  target: string;
  result: EndpointResult;
  error?: string;
};

type Due = {
  observations: { result: EndpointResult; updatedAt: Date }[];
  deployments: { deployedAt: Date | null }[];
};

/**
 * Endpoint checks (ADR 0020, Renewal and delivery): after a deployment,
 * and on a schedule, Harpocrates connects to each target's endpoint and
 * records which certificate it actually serves: the target's, one it
 * deployed before (nginx not reloaded), another, or none; and whether it
 * staples an OCSP response (ADR 0036). An answer that does not change
 * stays one row, last seen when last checked.
 */
@Injectable()
export class EndpointCheckService {
  private readonly logger = new Logger(EndpointCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly probe: EndpointProbe,
    @Inject(deployConfig.KEY) private readonly config: DeployConfigType,
  ) {}

  /** Checks every endpoint that is due a check; none while checks are off. */
  async checkDue(now = new Date()): Promise<EndpointCheck[]> {
    if (this.config.checkSeconds === 0) return [];
    const targets = await this.prisma.deployTarget.findMany({
      include: {
        observations: { orderBy: { updatedAt: "desc" }, take: 1 },
        deployments: {
          where: { status: "deployed" },
          orderBy: { deployedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
    const checks: EndpointCheck[] = [];
    for (const target of targets) {
      if (this.due(target, now)) checks.push(await this.check(target.id));
    }
    return checks;
  }

  /** Checks one target's endpoint now. */
  async check(targetId: string): Promise<EndpointCheck> {
    const target = await this.prisma.deployTarget.findUnique({
      where: { id: targetId },
      include: {
        certificate: { select: { id: true, der: true } },
        observations: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });
    if (!target) {
      throw new NotFoundException(
        `Deploy target with id ${targetId} not found`,
      );
    }
    let probe = await this.probe.probe(target.endpoint);
    if (!("error" in probe) && !probe.stapled && mustStaple(probe.der)) {
      await new Promise((resolve) => setTimeout(resolve, STAPLE_RETRY_MS));
      probe = await this.probe.probe(target.endpoint);
    }
    let observation: {
      result: EndpointResult;
      servedCertificateId?: string;
      servedSha256?: string;
      servedSerial?: string;
      servedSubject?: string;
      servedNotAfter?: Date;
      servedMustStaple?: boolean;
      stapled?: boolean;
      error?: string;
    };
    if ("error" in probe) {
      observation = { result: "unreachable", error: probe.error };
    } else {
      const served = Buffer.from(probe.der);
      const parsed = (() => {
        try {
          return parseCertificate(certificatePem(served));
        } catch {
          return undefined;
        }
      })();
      const deployed = served.equals(Buffer.from(target.certificate.der))
        ? { id: target.certificate.id, current: true }
        : await this.deployedBefore(target.id, served);
      observation = {
        result: deployed
          ? deployed.current
            ? "current"
            : "previous"
          : "other",
        servedCertificateId: deployed?.id,
        servedSha256: createHash("sha256").update(served).digest("hex"),
        servedSerial: parsed?.serial,
        servedSubject: parsed?.subject,
        servedNotAfter: parsed?.notAfter,
        servedMustStaple: mustStaple(served),
        stapled: probe.stapled,
      };
    }

    const last = target.observations[0];
    if (
      last &&
      last.endpoint === target.endpoint &&
      last.result === observation.result &&
      last.expectedCertificateId === target.certificateId &&
      last.servedSha256 === (observation.servedSha256 ?? null) &&
      last.stapled === (observation.stapled ?? null) &&
      last.error === (observation.error ?? null)
    ) {
      await this.prisma.endpointObservation.update({
        where: { id: last.id },
        data: { checks: { increment: 1 } },
      });
    } else {
      await this.prisma.endpointObservation.create({
        data: {
          targetId: target.id,
          endpoint: target.endpoint,
          expectedCertificateId: target.certificateId,
          ...observation,
        },
      });
      if (observation.result !== "current") {
        this.logger.warn(
          `${target.endpoint} (${target.name}) serves ${describe(observation)}`,
        );
      }
      if (observation.servedMustStaple && !observation.stapled) {
        this.logger.warn(
          `${target.endpoint} (${target.name}) serves a must-staple certificate without stapling its OCSP response`,
        );
      }
    }
    return {
      target: target.name,
      result: observation.result,
      error: observation.error,
    };
  }

  /**
   * Due: once a deployment has had time to land; then every
   * ENDPOINT_CHECK_SECONDS while it serves the target's certificate, and
   * every 5 minutes while it does not.
   */
  private due(target: Due, now: Date): boolean {
    const deployedAt = target.deployments[0]?.deployedAt?.getTime();
    if (deployedAt !== undefined && now.getTime() < deployedAt + SETTLE_MS) {
      return false;
    }
    const last = target.observations[0];
    if (!last) return true;
    const seen = last.updatedAt.getTime();
    // Not checked since the deployment: the scheduler waited for it to land.
    if (deployedAt !== undefined && seen < deployedAt) return true;
    const every =
      last.result === "current"
        ? this.config.checkSeconds * 1000
        : Math.min(this.config.checkSeconds * 1000, RECHECK_MS);
    return seen + every <= now.getTime();
  }

  /** A certificate this target deployed before, if it is the one served. */
  private async deployedBefore(
    targetId: string,
    served: Buffer,
  ): Promise<{ id: string; current: false } | undefined> {
    const candidates = await this.prisma.certificate.findMany({
      where: { deployments: { some: { targetId } } },
      select: { id: true, der: true },
    });
    const match = candidates.find((c) => served.equals(Buffer.from(c.der)));
    return match ? { id: match.id, current: false } : undefined;
  }
}

/** Whether a served certificate requires stapling; false if unreadable. */
const mustStaple = (der: Uint8Array): boolean => {
  try {
    return isMustStaple(der);
  } catch {
    return false;
  }
};

const describe = (observation: {
  result: EndpointResult;
  servedSerial?: string;
  error?: string;
}): string => {
  switch (observation.result) {
    case "previous":
      return `a certificate it deployed before (serial ${observation.servedSerial}): not reloaded?`;
    case "other":
      return `a certificate it never deployed (serial ${observation.servedSerial ?? "unreadable"})`;
    case "unreachable":
      return `nothing: ${observation.error}`;
    default:
      return "its certificate";
  }
};

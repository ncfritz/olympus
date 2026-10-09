import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Crl as CrlRow, Issuer as IssuerRow } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { SYSTEM } from "../../auth/principal";
import { pkiConfig, type PkiConfigType } from "../../config/configuration";
import { crlPublicationFailures } from "../../metrics/pkiMetrics";
import { crlSignedBy } from "../../pki/crl";
import { certificatePem } from "../../pki/x509";
import { PrismaService } from "../../store/PrismaService";

/** The first retry after 30 seconds, doubling, at most every 15 minutes. */
const FIRST_RETRY_MS = 30_000;
const MAX_RETRY_MS = 15 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;

export type Publication = { issuerId: string; number: bigint; error?: string };

type Pending = CrlRow & { issuer: IssuerRow };

const retryAt = (crl: CrlRow): Date =>
  crl.publishAttempts === 0 || !crl.lastAttemptAt
    ? new Date(0)
    : new Date(
        crl.lastAttemptAt.getTime() +
          Math.min(
            FIRST_RETRY_MS * 2 ** (crl.publishAttempts - 1),
            MAX_RETRY_MS,
          ),
      );

/**
 * Publication (ADR 0020, Serials, revocation and publication): each CA's
 * newest list and its certificate, DER, written to the directory the
 * distribution host serves, then fetched back through the distribution
 * URL and checked before the list counts as published. Failures are
 * retried with a backoff and alert.
 */
@Injectable()
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(pkiConfig.KEY) private readonly pki: PkiConfigType,
  ) {}

  /** Publishes every CA's newest list that is not yet out and due a try. */
  async publishPending(now = new Date()): Promise<Publication[]> {
    const issuers = await this.prisma.issuer.findMany({
      where: { crls: { some: { publishedAt: null } } },
      include: { crls: { orderBy: { number: "desc" }, take: 1 } },
      orderBy: { id: "asc" },
    });
    const results: Publication[] = [];
    for (const { crls, ...issuer } of issuers) {
      const newest = crls[0];
      if (!newest || newest.publishedAt || retryAt(newest) > now) continue;
      results.push(await this.publishList({ ...newest, issuer }));
    }
    return results;
  }

  private async publishList(crl: Pending): Promise<Publication> {
    const { issuer } = crl;
    const attemptedAt = new Date();
    try {
      if (!issuer.certificate) throw new Error("The CA has no certificate");
      await this.write(path.join("ca", `${issuer.id}.crt`), issuer.certificate);
      await this.write(path.join("crl", `${issuer.id}.crl`), crl.der);
      await this.readBack(issuer.caIssuersUrl, issuer.certificate);
      const served = await this.readBack(issuer.crlUrl, crl.der);
      if (!(await crlSignedBy(served, certificatePem(issuer.certificate)))) {
        throw new Error(`${issuer.crlUrl} does not verify against the CA`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.failed(crl, attemptedAt, message);
      return { issuerId: issuer.id, number: crl.number, error: message };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.crl.update({
        where: { id: crl.id },
        data: {
          publishedAt: attemptedAt,
          lastAttemptAt: attemptedAt,
          publishAttempts: { increment: 1 },
          lastError: null,
        },
      });
      await tx.issuer.update({
        where: { id: issuer.id },
        data: { certificatePublishedAt: attemptedAt },
      });
      await this.audit.record(
        {
          kind: AuditKind.CrlPublished,
          principal: SYSTEM,
          subjectType: "issuer",
          subjectId: issuer.id,
          attributes: { number: crl.number.toString(), url: issuer.crlUrl },
        },
        tx,
      );
    });
    this.logger.log(`Published list ${crl.number} of ${issuer.id}`);
    return { issuerId: issuer.id, number: crl.number };
  }

  private async failed(
    crl: Pending,
    attemptedAt: Date,
    message: string,
  ): Promise<void> {
    crlPublicationFailures.inc({ issuer: crl.issuerId });
    this.logger.warn(
      `Publishing list ${crl.number} of ${crl.issuerId} failed (attempt ${crl.publishAttempts + 1}): ${message}`,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.crl.update({
        where: { id: crl.id },
        data: {
          lastAttemptAt: attemptedAt,
          publishAttempts: { increment: 1 },
          lastError: message,
        },
      });
      // Once per list: the retries are in the list's own record.
      if (crl.publishAttempts === 0) {
        await this.audit.record(
          {
            kind: AuditKind.CrlPublicationFailed,
            principal: SYSTEM,
            subjectType: "issuer",
            subjectId: crl.issuerId,
            reason: message,
            attributes: { number: crl.number.toString() },
          },
          tx,
        );
      }
    });
  }

  /** Written beside, then renamed: nginx never serves half a file. */
  private async write(relative: string, data: Uint8Array): Promise<void> {
    const file = path.join(this.pki.publishedDir, relative);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o755 });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, data, { mode: 0o644 });
    await fs.rename(temporary, file);
  }

  /** What the distribution URL serves, which must be what was written. */
  private async readBack(url: string, expected: Uint8Array): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      const cause =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error
            ? error.message
            : String(error);
      throw new Error(`${url} is unreachable: ${cause}`, { cause: error });
    }
    if (response.status !== 200) {
      throw new Error(`${url} answered ${response.status}`);
    }
    const served = Buffer.from(await response.arrayBuffer());
    if (!served.equals(Buffer.from(expected))) {
      throw new Error(`${url} serves something other than what was written`);
    }
    return served;
  }
}

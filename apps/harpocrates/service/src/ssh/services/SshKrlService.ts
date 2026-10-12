import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { SYSTEM } from "../../auth/principal";
import {
  crlConfig,
  type CrlConfigType,
  pkiConfig,
  type PkiConfigType,
} from "../../config/configuration";
import { buildKrl } from "../../pki/ssh";
import { PrismaService } from "../../store/PrismaService";

const HOUR = 3600 * 1000;

/**
 * Each SSH CA's KRL (ADR 0035): the serials of its revoked certificates
 * that have not yet expired, written to the published directory at
 * `krl/<slug>.krl` as soon as one is revoked, and again every
 * CRL_REFRESH_HOURS. Unsigned (sshd does not check a KRL's signature), so
 * no signer is needed and a sealed signer does not stop it.
 */
@Injectable()
export class SshKrlService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SshKrlService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<unknown>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(pkiConfig.KEY) private readonly pki: PkiConfigType,
    @Inject(crlConfig.KEY) private readonly crl: CrlConfigType,
  ) {}

  onApplicationBootstrap(): void {
    if (this.crl.scheduleSeconds === 0) return;
    this.timer = setInterval(
      () => void this.kick(),
      this.crl.scheduleSeconds * 1000,
    );
    void this.kick();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** A pass now, unless one is running; its failures logged. */
  kick(): Promise<unknown> {
    this.running ??= this.writeDue()
      .catch((error: unknown) =>
        this.logger.error(`Publishing KRLs failed: ${String(error)}`),
      )
      .finally(() => (this.running = undefined));
    return this.running;
  }

  /** Writes each KRL that is due, or older than CRL_REFRESH_HOURS. */
  async writeDue(now = new Date()): Promise<string[]> {
    const stale = new Date(now.getTime() - this.crl.refreshHours * HOUR);
    const due = await this.prisma.sshCa.findMany({
      where: {
        OR: [
          { krlDueAt: { lte: now } },
          { krlPublishedAt: null },
          { krlPublishedAt: { lt: stale } },
        ],
      },
    });
    const published: string[] = [];
    for (const ca of due) {
      await this.writeKrl(ca.id, now);
      published.push(ca.id);
    }
    return published;
  }

  /** Builds and writes one CA's KRL now. */
  async writeKrl(caId: string, now = new Date()): Promise<void> {
    const ca = await this.prisma.sshCa.findUniqueOrThrow({
      where: { id: caId },
    });
    const revoked = await this.prisma.sshCertificate.findMany({
      where: { sshCaId: caId, status: "revoked", validBefore: { gt: now } },
      select: { serial: true },
    });
    const krl = buildKrl({
      caPublicKey: ca.publicKey,
      serials: revoked.map((r) => BigInt(`0x${r.serial}`)),
      version: ca.nextKrlNumber,
      generatedAt: now,
      comment: ca.name,
    });
    await this.write(path.join("krl", `${ca.id}.krl`), krl);
    await this.prisma.$transaction(async (tx) => {
      await tx.sshCa.update({
        where: { id: caId },
        data: {
          nextKrlNumber: { increment: 1 },
          krlDueAt: null,
          krlPublishedAt: now,
        },
      });
      await this.audit.record(
        {
          kind: AuditKind.SshKrlPublished,
          principal: SYSTEM,
          subjectType: "ssh-ca",
          subjectId: caId,
          attributes: {
            version: ca.nextKrlNumber.toString(),
            revoked: revoked.length,
          },
        },
        tx,
      );
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
}

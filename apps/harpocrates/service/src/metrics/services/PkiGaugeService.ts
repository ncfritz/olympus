import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Gauge, register } from "prom-client";
import { issuingWindowClosesAt } from "../../issuers/issuingWindow";
import { SignerService } from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";

const DAY = 24 * 60 * 60 * 1000;

/**
 * A scrape must not fail because the database is down: the gauges are
 * then empty, and the alert on their absence is the monitoring stack's.
 */
const quietly = async <T>(read: () => Promise<T[]>): Promise<T[]> => {
  try {
    return await read();
  } catch {
    return [];
  }
};

const days = (until: Date) =>
  Math.round(((until.getTime() - Date.now()) / DAY) * 10) / 10;

/**
 * Gauges read from the database and the signer when Prometheus scrapes:
 * what the monitoring stack's alerts are written against (ADR 0020,
 * Monitoring). Alerting lives there, so it never depends on the CA.
 */
@Injectable()
export class PkiGaugeService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
  ) {}

  onModuleInit(): void {
    // Each collect() reads this instance's dependencies: replace any gauge
    // an earlier application in this process registered.
    for (const name of [
      "certificate_expiry_days",
      "harpocrates_issuing_window_days",
      "harpocrates_signer_sealed",
    ]) {
      register.removeSingleMetric(name);
    }
    const prisma = this.prisma;
    const signer = this.signer;

    new Gauge({
      name: "certificate_expiry_days",
      help: "Days until each valid certificate the CA knows of expires",
      labelNames: ["issuer", "profile", "subject", "serial"],
      async collect() {
        this.reset();
        const rows = await quietly(() =>
          prisma.certificate.findMany({
            where: {
              status: "valid",
              notAfter: { gt: new Date(Date.now() - 30 * DAY) },
            },
            select: {
              issuerId: true,
              profileId: true,
              subject: true,
              serial: true,
              notAfter: true,
            },
          }),
        );
        for (const row of rows) {
          this.set(
            {
              issuer: row.issuerId,
              profile: row.profileId ?? "none",
              subject: row.subject,
              serial: row.serial,
            },
            days(row.notAfter),
          );
        }
      },
    });

    new Gauge({
      name: "harpocrates_issuing_window_days",
      help: "Days until each active CA stops issuing (its successor should exist first)",
      labelNames: ["issuer"],
      async collect() {
        this.reset();
        const rows = await quietly(() =>
          prisma.issuer.findMany({
            where: { status: "active", notAfter: { not: null } },
            select: { id: true, notAfter: true, maxValidityDays: true },
          }),
        );
        for (const row of rows) {
          this.set(
            { issuer: row.id },
            days(issuingWindowClosesAt(row.notAfter!, row.maxValidityDays)),
          );
        }
      },
    });

    new Gauge({
      name: "harpocrates_signer_sealed",
      help: "1 when the signer is sealed or unreachable, 0 when it signs",
      async collect() {
        try {
          this.set((await signer.status()).sealed ? 1 : 0);
        } catch {
          this.set(1);
        }
      },
    });
  }
}

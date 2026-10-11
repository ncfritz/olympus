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
      "harpocrates_profile_renewal_due_days",
      "harpocrates_crl_next_update_timestamp_seconds",
      "harpocrates_crl_publication_pending_seconds",
      "harpocrates_deploy_target_serving",
      "harpocrates_deployment_pending_seconds",
      "harpocrates_deploy_target_checked_timestamp_seconds",
      "harpocrates_deploy_target_served_expiry_timestamp_seconds",
    ]) {
      register.removeSingleMetric(name);
    }
    const prisma = this.prisma;
    const signer = this.signer;

    new Gauge({
      name: "certificate_expiry_days",
      help: "Days until each valid certificate the CA knows of expires",
      labelNames: ["issuer", "profile", "subject", "serial", "renewal"],
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
              renewedBy: { select: { id: true } },
              deployTargets: { select: { id: true } },
              acmeOrder: { select: { id: true } },
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
              // Whether it still needs renewing, and by whom: renewed (its
              // successor exists, so it needs nothing), automatic (a deploy
              // target's, which Harpocrates renews, or ACME's, which its
              // client renews), or manual.
              renewal: row.renewedBy
                ? "renewed"
                : row.deployTargets.length > 0 || row.acmeOrder
                  ? "automatic"
                  : "manual",
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
      name: "harpocrates_profile_renewal_due_days",
      help: "Days before expiry a certificate of each profile is due for renewal: its validity less its renewal age",
      labelNames: ["profile"],
      async collect() {
        this.reset();
        const rows = await quietly(() =>
          prisma.profile.findMany({
            select: { id: true, validityDays: true, renewAtDays: true },
          }),
        );
        for (const row of rows) {
          this.set({ profile: row.id }, row.validityDays - row.renewAtDays);
        }
      },
    });

    // Absolute times, not days left: after the service stops, the last
    // value still says when the list lapses (max_over_time in the rules).
    new Gauge({
      name: "harpocrates_crl_next_update_timestamp_seconds",
      help: "When each CA's newest published revocation list lapses, as a Unix time",
      labelNames: ["issuer", "tier"],
      async collect() {
        this.reset();
        const rows = await quietly(() =>
          prisma.issuer.findMany({
            where: { crls: { some: { publishedAt: { not: null } } } },
            select: {
              id: true,
              tier: true,
              crls: {
                where: { publishedAt: { not: null } },
                orderBy: { number: "desc" },
                take: 1,
                select: { nextUpdate: true },
              },
            },
          }),
        );
        for (const row of rows) {
          const newest = row.crls[0];
          if (!newest) continue;
          this.set(
            { issuer: row.id, tier: row.tier },
            Math.floor(newest.nextUpdate.getTime() / 1000),
          );
        }
      },
    });

    new Gauge({
      name: "harpocrates_crl_publication_pending_seconds",
      help: "How long each CA's newest list has waited to be published; 0 once it is",
      labelNames: ["issuer", "tier"],
      async collect() {
        this.reset();
        const rows = await quietly(() =>
          prisma.issuer.findMany({
            where: { crls: { some: {} } },
            select: {
              id: true,
              tier: true,
              crls: {
                orderBy: { number: "desc" },
                take: 1,
                select: { createdAt: true, publishedAt: true },
              },
            },
          }),
        );
        for (const row of rows) {
          const newest = row.crls[0];
          if (!newest) continue;
          this.set(
            { issuer: row.id, tier: row.tier },
            newest.publishedAt
              ? 0
              : Math.round((Date.now() - newest.createdAt.getTime()) / 1000),
          );
        }
      },
    });

    // What each deploy target's endpoint served when last checked: 1 for
    // the answer it gave (current, previous, other, unreachable), 0 for
    // the rest, so `== 0` on current is the alert whatever went wrong.
    const latestObservations = () =>
      quietly(() =>
        prisma.deployTarget.findMany({
          select: {
            name: true,
            observations: { orderBy: { updatedAt: "desc" }, take: 1 },
          },
        }),
      );

    new Gauge({
      name: "harpocrates_deploy_target_serving",
      help: "What each deploy target's endpoint served when last checked: 1 for its result (current, previous, other, unreachable), 0 for the others",
      labelNames: ["target", "result"],
      async collect() {
        this.reset();
        for (const row of await latestObservations()) {
          const last = row.observations[0];
          if (!last) continue;
          for (const result of [
            "current",
            "previous",
            "other",
            "unreachable",
          ]) {
            this.set(
              { target: row.name, result },
              last.result === result ? 1 : 0,
            );
          }
        }
      },
    });

    new Gauge({
      name: "harpocrates_deployment_pending_seconds",
      help: "How long each deploy target's pending deployment has waited, failing or not yet tried; 0 when it has none",
      labelNames: ["target"],
      async collect() {
        this.reset();
        const rows = await quietly(() =>
          prisma.deployTarget.findMany({
            select: {
              name: true,
              deployments: {
                where: { status: "pending" },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          }),
        );
        for (const row of rows) {
          const oldest = row.deployments[0];
          this.set(
            { target: row.name },
            oldest
              ? Math.round((Date.now() - oldest.createdAt.getTime()) / 1000)
              : 0,
          );
        }
      },
    });

    new Gauge({
      name: "harpocrates_deploy_target_checked_timestamp_seconds",
      help: "When each deploy target's endpoint was last checked, as a Unix time",
      labelNames: ["target"],
      async collect() {
        this.reset();
        for (const row of await latestObservations()) {
          const last = row.observations[0];
          if (last) {
            this.set({ target: row.name }, last.updatedAt.getTime() / 1000);
          }
        }
      },
    });

    new Gauge({
      name: "harpocrates_deploy_target_served_expiry_timestamp_seconds",
      help: "When the certificate each deploy target's endpoint served at its last check expires, as a Unix time",
      labelNames: ["target"],
      async collect() {
        this.reset();
        for (const row of await latestObservations()) {
          const served = row.observations[0]?.servedNotAfter;
          if (served) {
            this.set({ target: row.name }, served.getTime() / 1000);
          }
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

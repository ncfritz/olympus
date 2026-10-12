import { Injectable } from "@nestjs/common";
import type { CertificateHealthName } from "../../model/dashboard";
import type { CertificateStateName } from "../../model/certificates";
import { PrismaService } from "../../store/PrismaService";
import type { RevocationReason } from "../../store/prisma";
import { healthOf, renewalDueAt, renewedOverMtls, renewerOf } from "../renewal";

const DAY = 24 * 60 * 60 * 1000;

/** How long after its newest version ends a lineage is still listed. */
export const ENDED_DAYS = 365;

export type VersionRow = {
  certificateId: string;
  issuerId: string;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  issuedAt: Date;
  state: CertificateStateName;
  revokedAt?: Date;
  revocationReason?: RevocationReason;
  renews: boolean;
};

export type LineageRow = {
  lineageId: string;
  name: string;
  names: string[];
  issuerId: string;
  profileId?: string;
  state: CertificateStateName;
  health?: CertificateHealthName;
  renewalDueAt: Date;
  renewal: "automatic" | "manual";
  renewer: "acme" | "deploy-target" | "mtls" | "person";
  deployTargets: string[];
  versions: VersionRow[];
};

/** The common name of an RFC 4514 subject, or the subject. */
const nameOf = (subject: string): string =>
  /(?:^|,)CN=((?:\\.|[^,])*)/.exec(subject)?.[1]?.replace(/\\(.)/g, "$1") ??
  subject;

/**
 * The certificates as lineages (the console's certificates list): each
 * subject's certificates together, linked by renewal or issued again by
 * the same CA for the same subject (an ACME client's next order names no
 * certificate it renews), newest first; how the newest is renewed, as the
 * dashboard reads it.
 */
@Injectable()
export class LineageService {
  constructor(private readonly prisma: PrismaService) {}

  async list(now = new Date()): Promise<LineageRow[]> {
    const rows = await this.prisma.certificate.findMany({
      select: {
        id: true,
        issuerId: true,
        profileId: true,
        serial: true,
        subject: true,
        notBefore: true,
        notAfter: true,
        status: true,
        renewsId: true,
        createdAt: true,
        revocation: { select: { revokedAt: true, reason: true } },
        acmeOrder: { select: { id: true } },
        deployTargets: { select: { name: true } },
        enrollment: { select: { names: { select: { value: true } } } },
        profileVersion: { select: { validityDays: true, renewAtDays: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    // Union-find: a renewal joins what it renews; a CA's certificates for
    // one subject join each other.
    const parent = new Map(rows.map((row) => [row.id, row.id]));
    const find = (id: string): string => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root)!;
      parent.set(id, root);
      return root;
    };
    const join = (a: string, b: string) => {
      const [x, y] = [find(a), find(b)];
      if (x !== y) parent.set(y, x);
    };
    const bySubject = new Map<string, string>();
    for (const row of rows) {
      if (row.renewsId && parent.has(row.renewsId)) join(row.renewsId, row.id);
      const key = `${row.issuerId}\n${row.subject}`;
      const first = bySubject.get(key);
      if (first) join(first, row.id);
      else bySubject.set(key, row.id);
    }
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const root = find(row.id);
      groups.set(root, [...(groups.get(root) ?? []), row]);
    }

    const since = now.getTime() - ENDED_DAYS * DAY;
    const listed = [...groups.values()]
      .map((versions) => versions.toReversed())
      .filter(([newest]) => newest.notAfter.getTime() > since);
    const overMtls = await renewedOverMtls(
      this.prisma,
      listed.map(([newest]) => newest.id),
    );

    return listed
      .map((versions): LineageRow => {
        const newest = versions[0];
        const state: CertificateStateName =
          newest.status === "revoked"
            ? "revoked"
            : newest.notAfter <= now
              ? "expired"
              : "valid";
        const renewer = renewerOf(newest, overMtls);
        const renewal = renewer === "person" ? "manual" : "automatic";
        const dueAt = renewalDueAt(newest.notAfter, newest.profileVersion);
        return {
          lineageId: versions.at(-1)!.id,
          name: nameOf(newest.subject),
          names: newest.enrollment?.names.map((n) => n.value) ?? [],
          issuerId: newest.issuerId,
          profileId: newest.profileId ?? undefined,
          state,
          health:
            state === "revoked"
              ? undefined
              : healthOf(newest.notAfter, dueAt, renewal, now),
          renewalDueAt: dueAt,
          renewal,
          renewer,
          deployTargets: newest.deployTargets.map((t) => t.name),
          versions: versions.map((v, i) => ({
            certificateId: v.id,
            issuerId: v.issuerId,
            serial: v.serial,
            notBefore: v.notBefore,
            notAfter: v.notAfter,
            issuedAt: v.createdAt,
            state:
              v.status === "revoked"
                ? "revoked"
                : v.notAfter <= now
                  ? "expired"
                  : "valid",
            revokedAt: v.revocation?.revokedAt,
            revocationReason: v.revocation?.reason,
            renews: i < versions.length - 1,
          })),
        };
      })
      .sort(
        (a, b) =>
          a.versions[0].notAfter.getTime() - b.versions[0].notAfter.getTime(),
      );
  }
}

import { Injectable } from "@nestjs/common";
import moment from "moment";
import type { SshActivityCertificate, SshCaActivity } from "../../model/ssh";
import { PrismaService } from "../../store/PrismaService";

const DAY = 24 * 60 * 60 * 1000;

/** How far back revocations are read: the KRL graph's year. */
const REVOKED_DAYS = 365;

/**
 * The console's reading of the SSH CAs (ADR 0035): each CA's certificates
 * counted, and the certificates its graphs draw (issued in the last days,
 * valid now, or revoked in the last year).
 */
@Injectable()
export class SshActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async activity(
    days: number,
    now: Date,
  ): Promise<{
    since: Date;
    cas: SshCaActivity[];
    certificates: SshActivityCertificate[];
  }> {
    const since = new Date(now.getTime() - days * DAY);
    const current = { status: "valid" as const, validBefore: { gt: now } };
    const [cas, valid, issued, issuedEver, inKrl, lastExpiry, rows] =
      await Promise.all([
        this.prisma.sshCa.findMany({
          select: { id: true },
          orderBy: [{ type: "asc" }, { number: "asc" }, { generation: "desc" }],
        }),
        this.countBy(current),
        this.countBy({ createdAt: { gte: since } }),
        this.countBy({}),
        this.countBy({ status: "revoked", validBefore: { gt: now } }),
        this.prisma.sshCertificate.groupBy({
          by: ["sshCaId"],
          _max: { validBefore: true },
        }),
        this.prisma.sshCertificate.findMany({
          where: {
            OR: [
              { createdAt: { gte: since } },
              current,
              {
                revokedAt: {
                  gte: new Date(now.getTime() - REVOKED_DAYS * DAY),
                },
              },
            ],
          },
          include: { principals: { orderBy: { position: "asc" } } },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    const last = new Map(
      lastExpiry.map((row) => [row.sshCaId, row._max.validBefore]),
    );
    return {
      since,
      cas: cas.map(({ id }) => {
        const lastExpiresAt = last.get(id);
        return {
          caId: id,
          valid: valid.get(id) ?? 0,
          issued: issued.get(id) ?? 0,
          issuedEver: issuedEver.get(id) ?? 0,
          inKrl: inKrl.get(id) ?? 0,
          lastExpiresAt: lastExpiresAt ? moment(lastExpiresAt) : undefined,
        };
      }),
      certificates: rows.map((row) => ({
        id: row.id,
        caId: row.sshCaId,
        type: row.type,
        principals: row.principals.map((p) => p.principal),
        identity: row.identity ?? undefined,
        renewal: row.renewsId !== null,
        validAfter: moment(row.validAfter),
        validBefore: moment(row.validBefore),
        revokedAt: row.revokedAt ? moment(row.revokedAt) : undefined,
        createdAt: moment(row.createdAt),
        updatedAt: moment(row.updatedAt),
      })),
    };
  }

  /** The certificates matching `where`, counted by CA. */
  private async countBy(
    where: NonNullable<
      Parameters<PrismaService["sshCertificate"]["groupBy"]>[0]
    >["where"],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.sshCertificate.groupBy({
      by: ["sshCaId"],
      where,
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.sshCaId, row._count._all]));
  }
}

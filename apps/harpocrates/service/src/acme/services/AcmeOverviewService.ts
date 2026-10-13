import { Injectable } from "@nestjs/common";
import moment from "moment";
import type { AcmeClient, AcmeOrderSummary } from "../../model/acme";
import { PrismaService } from "../../store/PrismaService";
import {
  CREDENTIAL_INCLUDE,
  toAcmeCredential,
} from "../converters/AcmeCredentialConverter";
import {
  ORDER_INCLUDE,
  toAcmeOrderSummary,
} from "../converters/AcmeOrderConverter";
import { renewalWindowOf } from "../renewalWindow";

const DAY = 24 * 60 * 60 * 1000;

/** The most orders a reading returns: far more than a month brings. */
const MAX_ORDERS = 5000;

/**
 * The console's reading of ACME (ADR 0020, ACME): each client (a
 * credential, and the account bound with it) with what it holds and when
 * it should renew, and the orders of the last days, step by step.
 */
@Injectable()
export class AcmeOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async clients(now: Date): Promise<AcmeClient[]> {
    const credentials = await this.prisma.acmeEabCredential.findMany({
      include: CREDENTIAL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    const accountIds = credentials.flatMap((c) =>
      c.account ? [c.account.id] : [],
    );
    const [issued, last] = await Promise.all([
      // Every order whose certificate has not expired, newest first.
      this.prisma.acmeOrder.findMany({
        where: {
          accountId: { in: accountIds },
          certificate: { is: { notAfter: { gt: now } } },
        },
        include: {
          account: { select: { credentialId: true } },
          authorizations: {
            select: { identifier: true },
            orderBy: { identifier: "asc" },
          },
          certificate: { include: { profileVersion: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.acmeOrder.findMany({
        where: { accountId: { in: accountIds } },
        distinct: ["accountId"],
        orderBy: [{ accountId: "asc" }, { createdAt: "desc" }],
        include: ORDER_INCLUDE,
      }),
    ]);

    // For each client and set of names, the newest certificate; held while valid.
    const held = new Map<string, AcmeClient["certificates"]>();
    const seen = new Set<string>();
    for (const order of issued) {
      const certificate = order.certificate!;
      const names = order.authorizations.map((a) => a.identifier);
      const key = `${order.account.credentialId} ${names.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (certificate.status !== "valid") continue;
      const window = renewalWindowOf(
        {
          status: certificate.status,
          notBefore: certificate.notBefore,
          notAfter: certificate.notAfter,
          renewAtDays: certificate.profileVersion?.renewAtDays,
        },
        now.getTime(),
      );
      const list = held.get(order.account.credentialId) ?? [];
      list.push({
        certificateId: certificate.id,
        issuerId: certificate.issuerId,
        names,
        notBefore: moment(certificate.notBefore),
        notAfter: moment(certificate.notAfter),
        renewalStart: moment(window.start),
        renewalEnd: moment(window.end),
        issuedAt: moment(certificate.createdAt),
      });
      held.set(order.account.credentialId, list);
    }
    const lastOrders = new Map(
      last.map((order) => [order.account.credentialId, order]),
    );

    return credentials.map((credential) => {
      const lastOrder = lastOrders.get(credential.id);
      return {
        credential: toAcmeCredential(credential),
        certificates: (held.get(credential.id) ?? []).sort(
          (a, b) => a.renewalStart.valueOf() - b.renewalStart.valueOf(),
        ),
        lastOrder: lastOrder ? toAcmeOrderSummary(lastOrder) : undefined,
      };
    });
  }

  /** The orders placed in the last `days`, to `now`, newest first. */
  async orders(
    days: number,
    now: Date,
  ): Promise<{ since: Date; orders: AcmeOrderSummary[] }> {
    const since = new Date(now.getTime() - days * DAY);
    const rows = await this.prisma.acmeOrder.findMany({
      where: { createdAt: { gte: since } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: MAX_ORDERS,
    });
    return { since, orders: rows.map(toAcmeOrderSummary) };
  }
}

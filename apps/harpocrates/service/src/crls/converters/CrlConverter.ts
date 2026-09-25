import type { Crl as CrlRow } from "@prisma/client";
import moment from "moment";
import type { RevocationList } from "../../model/crls";

export type CrlWithUrl = CrlRow & { issuer: { crlUrl: string } };

export const CRL_URL = { issuer: { select: { crlUrl: true } } } as const;

export const toDomainObject = (row: CrlWithUrl): RevocationList => ({
  issuerId: row.issuerId,
  number: Number(row.number),
  source: row.source,
  thisUpdate: moment(row.thisUpdate),
  nextUpdate: moment(row.nextUpdate),
  entries: row.entries,
  publishedAt: row.publishedAt ? moment(row.publishedAt) : undefined,
  publishAttempts: row.publishAttempts,
  lastError: row.lastError ?? undefined,
  url: row.issuer.crlUrl,
});

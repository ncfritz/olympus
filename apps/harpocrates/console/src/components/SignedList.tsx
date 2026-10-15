"use client";

import { Table, Tag } from "antd";
import Link from "next/link";
import { useCertificates } from "@/lib/api/queries";
import type { Certificate, CertificateState, Issuer } from "@/lib/api/types";
import {
  formatDate,
  issuedTypeName,
  namesOf,
  STATE_COLORS,
  STATUS_COLORS,
  TIERS,
} from "@/lib/labels";
import { commonName } from "@/lib/tree";

/** As many leaves as the list fetches: the newest. */
const LIMIT = 500;

type Row =
  | { kind: "ca"; key: string; issuer: Issuer }
  | { kind: "leaf"; key: string; certificate: Certificate };

/**
 * What a CA signed itself, in one list: the CAs directly beneath it, then
 * the leaf certificates it issued, newest first.
 */
export function SignedList({
  issuerId,
  issuers,
}: {
  issuerId: string;
  issuers: Issuer[];
}) {
  const { data, isLoading } = useCertificates({ issuerId, pageSize: LIMIT });
  const rows: Row[] = [
    ...issuers
      .filter((issuer) => issuer.parentId === issuerId)
      .map((issuer): Row => ({ kind: "ca", key: issuer.id, issuer })),
    ...(data?.certificates ?? []).map((certificate): Row => ({
      kind: "leaf",
      key: certificate.id,
      certificate,
    })),
  ];
  const more = (data?.count ?? 0) > LIMIT;

  return (
    <Table<Row>
      rowKey="key"
      size="small"
      loading={isLoading}
      dataSource={rows}
      pagination={{
        pageSize: 20,
        size: "small",
        showSizeChanger: false,
        showTotal: (total) =>
          more
            ? `${total} shown: the CAs and the newest ${LIMIT} of ${data!.count} certificates`
            : `${total} signed`,
      }}
      locale={{ emptyText: "It has signed nothing yet" }}
      columns={[
        {
          title: "Subject",
          key: "subject",
          ellipsis: true,
          render: (_, row) =>
            row.kind === "ca" ? (
              <Link href={`/ca?id=${row.issuer.id}`}>
                {commonName(row.issuer.subject)}
              </Link>
            ) : (
              <Link href={`/certificate?id=${row.certificate.id}`}>
                {commonName(row.certificate.subject)}
              </Link>
            ),
        },
        {
          title: "Type",
          key: "type",
          render: (_, row) =>
            row.kind === "ca"
              ? `${TIERS[row.issuer.tier]}${row.issuer.purpose ? `, ${row.issuer.purpose}` : ""}`
              : issuedTypeName({
                  tier: "leaf",
                  type: row.certificate.profileId ?? "other",
                }),
        },
        {
          title: "Names",
          key: "names",
          ellipsis: true,
          render: (_, row) =>
            row.kind === "leaf" ? namesOf(row.certificate) || "—" : "—",
        },
        {
          title: "Expires",
          key: "expires",
          render: (_, row) =>
            formatDate(
              row.kind === "ca"
                ? row.issuer.notAfter
                : row.certificate.notAfter,
            ),
        },
        {
          title: "State",
          key: "state",
          render: (_, row) =>
            row.kind === "ca" ? (
              <Tag color={STATUS_COLORS[row.issuer.status]}>
                {row.issuer.discardedAt ? "discarded" : row.issuer.status}
              </Tag>
            ) : (
              <Tag
                color={STATE_COLORS[row.certificate.state as CertificateState]}
              >
                {row.certificate.state}
              </Tag>
            ),
        },
      ]}
    />
  );
}

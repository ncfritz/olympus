import { Flex, Table, Tag, Typography } from "antd";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { DashboardAuthority, Issuer } from "@/lib/api/types";
import { timeUntil } from "@/lib/dashboard";
import { formatDate, formatDateTime } from "@/lib/labels";
import { freshness } from "@/lib/ocsp";
import { shortCaName } from "@/lib/tree";
import styles from "./Dashboard.module.css";

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;

/** A span's place on the lifetimes' axis: the only values set from code. */
const spanPlace = (from: number, to: number, start: number, end: number) =>
  ({
    "--from": `${((from - start) / (end - start)) * 100}%`,
    "--width": `${(Math.max(to - from, 0) / (end - start)) * 100}%`,
  }) as CSSProperties;

/**
 * Each CA's life against the others': the whole of its validity, the part
 * in which it still issues, and today. A CA issues while its longest
 * certificate still fits inside its own life.
 */
export function CaLifetimes({
  issuers,
  now,
}: {
  issuers: Issuer[];
  now: number;
}) {
  const live = issuers.filter(
    (i) =>
      (i.status === "active" || i.status === "closed") &&
      !i.discardedAt &&
      i.notBefore &&
      i.notAfter,
  );
  if (live.length === 0) {
    return (
      <Typography.Text type="secondary" className={styles.padded}>
        No CA in service yet.
      </Typography.Text>
    );
  }
  const start = Math.min(now, ...live.map((i) => Date.parse(i.notBefore!)));
  const end = Math.max(...live.map((i) => Date.parse(i.notAfter!)));
  const ticks = [0, 0.5, 1].map((f) =>
    new Date(start + f * (end - start)).getFullYear(),
  );

  return (
    <Flex vertical gap="small" className={styles.padded}>
      <Flex justify="space-between" align="center" gap="small" wrap>
        <Typography.Text strong className={styles.boxTitle}>
          CA lifetimes
        </Typography.Text>
        <Flex gap="middle" wrap className={styles.small}>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.issuesSwatch}`} />
            Issues
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles.validSwatch}`} />
            Valid, no longer issues
          </span>
          <span className={styles.legendItem}>
            <span className={styles.todaySwatch} />
            Today
          </span>
        </Flex>
      </Flex>
      <div className={styles.lifeRow}>
        <span />
        <Flex justify="space-between">
          {ticks.map((year, i) => (
            <Typography.Text key={i} type="secondary" className={styles.small}>
              {year}
            </Typography.Text>
          ))}
        </Flex>
      </div>
      {live.map((issuer) => {
        const from = Date.parse(issuer.notBefore!);
        const to = Date.parse(issuer.notAfter!);
        const closes = issuer.issuingWindowClosesAt
          ? Date.parse(issuer.issuingWindowClosesAt)
          : to;
        const left = closes - now;
        const [note, color] =
          left <= 0
            ? ["No longer issues", "default"]
            : [
                `issues ${timeUntil(issuer.issuingWindowClosesAt ?? issuer.notAfter!, now)}`,
                left < YEAR ? "orange" : "green",
              ];
        return (
          <div key={issuer.id} className={styles.lifeRow}>
            <Flex vertical className={styles.shrink}>
              <Link href={`/ca?id=${issuer.id}`}>
                <Typography.Text ellipsis className={styles.laneName}>
                  {shortCaName(issuer)}
                </Typography.Text>
              </Link>
              <Flex gap={4} align="center" wrap>
                <Typography.Text type="secondary" className={styles.small}>
                  {issuer.tier} · {issuer.offline ? "offline" : "online"}
                </Typography.Text>
                <Tag color={color} className={styles.fitTag}>
                  {note}
                </Tag>
              </Flex>
            </Flex>
            <div
              className={styles.lifeTrack}
              role="img"
              aria-label={`${shortCaName(issuer)}: valid ${formatDate(issuer.notBefore)} to ${formatDate(issuer.notAfter)}, issues until ${formatDate(issuer.issuingWindowClosesAt)}`}
            >
              <span
                className={`${styles.span} ${styles.valid}`}
                style={spanPlace(from, to, start, end)}
              />
              <span
                className={`${styles.span} ${styles.issues}`}
                style={spanPlace(from, Math.min(closes, to), start, end)}
              />
              <span
                className={styles.today}
                style={spanPlace(now, now, start, end)}
              />
            </div>
          </div>
        );
      })}
    </Flex>
  );
}

/** Each CA's revocation: its newest list, its OCSP, what it has revoked. */
export function AuthoritiesTable({
  authorities,
  issuers,
  now,
}: {
  authorities: DashboardAuthority[];
  issuers: Issuer[];
  now: number;
}) {
  const names = new Map(issuers.map((i) => [i.id, shortCaName(i)]));
  return (
    <Table<DashboardAuthority>
      rowKey="issuerId"
      size="middle"
      pagination={false}
      dataSource={authorities}
      scroll={authorities.length ? { x: "max-content" } : undefined}
      className={styles.flushTable}
      columns={[
        {
          title: "CA",
          key: "ca",
          render: (_, a) => (
            <Flex vertical>
              <Link href={`/ca?id=${a.issuerId}`}>
                {names.get(a.issuerId) ?? a.issuerId}
              </Link>
              <Typography.Text type="secondary" className={styles.small}>
                {a.offline ? "offline · ceremony" : "online"}
              </Typography.Text>
            </Flex>
          ),
        },
        {
          title: "List",
          key: "number",
          render: (_, a) =>
            a.number === undefined ? (
              "—"
            ) : (
              <Typography.Text
                code
                title={
                  a.publishedAt
                    ? `Published ${formatDateTime(a.publishedAt)}`
                    : "Waiting to be published"
                }
              >
                {a.number}
              </Typography.Text>
            ),
        },
        {
          title: "Lapses in",
          key: "lapses",
          render: (_, a) => {
            if (!a.nextUpdate) return "—";
            const left = Date.parse(a.nextUpdate) - now;
            const soon = a.offline ? left < 60 * DAY : left < 2 * DAY;
            return (
              <Typography.Text type={soon ? "danger" : undefined}>
                {left <= 0 ? "Lapsed" : timeUntil(a.nextUpdate, now)}
              </Typography.Text>
            );
          },
        },
        {
          title: "OCSP responder",
          key: "responder",
          render: (_, a) =>
            a.ocspResponderUntil ? (
              <span>
                to {formatDate(a.ocspResponderUntil)}
                {a.ocspInCeremony ? " (ceremony)" : ""}
              </span>
            ) : (
              <Typography.Text type="secondary">None</Typography.Text>
            ),
        },
        {
          title: "Responses",
          key: "responses",
          render: (_, a) => {
            if (!a.ocspResponderUntil && !a.ocspSoonestLapse)
              return <Tag>Not answered</Tag>;
            const { color, label } = freshness(a.ocspSoonestLapse, now);
            return <Tag color={color}>{label}</Tag>;
          },
        },
        { title: "Revoked", dataIndex: "revoked" },
      ]}
    />
  );
}

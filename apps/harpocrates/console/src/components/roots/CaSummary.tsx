import { Alert, Button, Descriptions, Flex, Tag, Typography } from "antd";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useIssued } from "@/lib/api/queries";
import type { DashboardAuthority, Issuer } from "@/lib/api/types";
import { timeUntil } from "@/lib/dashboard";
import { formatDate, SHAPES, TIERS } from "@/lib/labels";
import { freshness } from "@/lib/ocsp";
import { backupUnproved, closingSoon, windowOf } from "@/lib/roots";
import { commonName, shortCaName } from "@/lib/tree";
import { IssuedChart } from "../IssuedChart";
import styles from "./Roots.module.css";
import { CaIcon, certificatesOf, NameTags, StateTags } from "./shared";

/** A point's place along a CA's life: the only value set from code. */
const at = (point: number, from: number, to: number) =>
  ({
    "--at": `${Math.min(Math.max((point - from) / (to - from), 0), 1) * 100}%`,
  }) as CSSProperties;

/** The CAs above one, its root last. */
const chainOf = (issuers: Issuer[], issuer: Issuer): Issuer[] => {
  const parent = issuers.find((i) => i.id === issuer.parentId);
  return parent ? [parent, ...chainOf(issuers, parent)] : [];
};

/**
 * One CA beside the graph: what needs doing about it, its life (the part
 * in which it issues, and today), its chain, its certificates, its list
 * and OCSP, and what it has issued.
 */
export function CaSummary({
  issuer,
  issuers,
  authority,
  now,
  isAdmin,
}: {
  issuer: Issuer;
  issuers: Issuer[];
  authority: DashboardAuthority | undefined;
  now: number;
  isAdmin: boolean;
}) {
  const { data: issued } = useIssued(issuer.id);
  const chain = chainOf(issuers, issuer);
  const counts = certificatesOf(authority);
  const window = windowOf(issuer, now);
  const from = issuer.notBefore ? Date.parse(issuer.notBefore) : undefined;
  const to = issuer.notAfter ? Date.parse(issuer.notAfter) : undefined;
  const closes = window.closesAt ?? to;
  const outside = issuer.tier !== "root" && chain.at(-1)?.tier !== "root";

  return (
    <aside className={styles.summary} aria-label={shortCaName(issuer)}>
      <Flex gap="small" align="flex-start">
        <CaIcon issuer={issuer} outside={outside} />
        <Flex vertical gap={4} className={styles.shrink}>
          <Typography.Text strong className={styles.summaryTitle}>
            {commonName(issuer.subject)}
          </Typography.Text>
          <Flex gap={4} wrap className={styles.tags}>
            <Tag>{TIERS[issuer.tier]}</Tag>
            <NameTags issuer={issuer} />
          </Flex>
        </Flex>
      </Flex>
      {closingSoon(issuer, now) && (
        <Alert
          type="warning"
          showIcon
          title={`Stops issuing ${timeUntil(new Date(window.closesAt!).toISOString(), now)} from now`}
          description="What it signs must end before it does. Its successor is the next generation, created in a ceremony with its parent."
        />
      )}
      {backupUnproved(issuer) && (
        <Alert
          type="error"
          showIcon
          title="Its key's backup is not proved"
          description="Restore the backup in a ceremony: until then, losing the signer loses this CA."
        />
      )}
      {outside && (
        <Alert
          type="info"
          showIcon
          title="Its root is not in Harpocrates"
          description="It was imported with its chain; importing its root anchors it here."
        />
      )}
      {from !== undefined && to !== undefined && closes !== undefined && (
        <Flex vertical gap={4}>
          <Typography.Text type="secondary" className={styles.small}>
            Its life
          </Typography.Text>
          <div
            className={styles.life}
            role="img"
            aria-label={`Valid ${formatDate(issuer.notBefore)} to ${formatDate(issuer.notAfter)}, issues until ${formatDate(new Date(closes).toISOString())}`}
          >
            <span className={styles.lifeIssues} style={at(closes, from, to)} />
            {now >= from && now <= to && (
              <span className={styles.lifeToday} style={at(now, from, to)} />
            )}
          </div>
          <Flex justify="space-between" className={styles.small}>
            <Typography.Text type="secondary">
              {formatDate(issuer.notBefore)}
            </Typography.Text>
            <Typography.Text type="secondary">
              issues to {formatDate(new Date(closes).toISOString())}
            </Typography.Text>
            <Typography.Text type="secondary">
              {formatDate(issuer.notAfter)}
            </Typography.Text>
          </Flex>
        </Flex>
      )}
      <StateTags issuer={issuer} now={now} />
      <Descriptions column={1} size="small">
        <Descriptions.Item label="ID">
          <Typography.Text code>{issuer.id}</Typography.Text>
        </Descriptions.Item>
        {chain.length > 0 && (
          <Descriptions.Item label="Issued by">
            <Flex vertical>
              {chain.map((parent) => (
                <Link key={parent.id} href={`/ca?id=${parent.id}`}>
                  {shortCaName(parent)}
                </Link>
              ))}
            </Flex>
          </Descriptions.Item>
        )}
        {issuer.shape && (
          <Descriptions.Item label="Signs">
            {SHAPES[issuer.shape].signs}
          </Descriptions.Item>
        )}
        {issuer.purpose && (
          <Descriptions.Item label="Purpose">
            {issuer.purpose}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Certificates">
          {counts.valid} valid · {counts.expired} expired · {counts.revoked}{" "}
          revoked
        </Descriptions.Item>
        <Descriptions.Item label="List">
          {authority?.nextUpdate
            ? `#${authority.number}, lapses in ${timeUntil(authority.nextUpdate, now)}`
            : "None yet"}
        </Descriptions.Item>
        {authority &&
          (authority.ocspResponderUntil || authority.ocspSoonestLapse) && (
            <Descriptions.Item label="OCSP">
              <Tag color={freshness(authority.ocspSoonestLapse, now).color}>
                {freshness(authority.ocspSoonestLapse, now).label}
              </Tag>
              {authority.ocspResponderUntil &&
                `responder to ${formatDate(authority.ocspResponderUntil)}`}
            </Descriptions.Item>
          )}
        {issuer.offline && (
          <Descriptions.Item label="Key backup">
            {issuer.provedAt
              ? `Proved ${formatDate(issuer.provedAt)}`
              : "Not proved"}
          </Descriptions.Item>
        )}
      </Descriptions>
      {issued && issued.length > 0 && <IssuedChart counts={issued} />}
      <Flex gap="small" wrap>
        <Link href={`/ca?id=${issuer.id}`}>
          <Button type="primary">Open</Button>
        </Link>
        {isAdmin &&
          issuer.offline &&
          issuer.status !== "revoked" &&
          !outside && (
            <Link href={`/ca?id=${issuer.id}&ceremony=open`}>
              <Button>
                {issuer.provedAt ? "Open a ceremony" : "Prove the backup"}
              </Button>
            </Link>
          )}
      </Flex>
    </aside>
  );
}

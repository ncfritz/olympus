import { ExpandCaret } from "@ncfritz/olympus-console";
import {
  Button,
  Flex,
  Input,
  Progress,
  Select,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { type Key, useMemo, useState } from "react";
import type {
  DashboardAuthority,
  Issuer,
  IssuerStatus,
  IssuerTier,
} from "@/lib/api/types";
import { timeUntil } from "@/lib/dashboard";
import { formatDate, TIERS } from "@/lib/labels";
import { freshness } from "@/lib/ocsp";
import { groupsOf, inOrder, windowOf } from "@/lib/roots";
import { childrenOf, commonName, shortCaName } from "@/lib/tree";
import styles from "./Roots.module.css";
import { CaIcon, certificatesOf, NameTags } from "./shared";

const DAY = 24 * 60 * 60 * 1000;

/** A CA, how deep it sits beneath its root, and the CAs beneath it. */
type Row = { key: string; issuer: Issuer; level: number; children?: Row[] };

const rowsOf = (issuers: Issuer[], tops: Issuer[], level = 0): Row[] =>
  tops.map((issuer) => {
    const children = rowsOf(issuers, childrenOf(issuers, issuer.id), level + 1);
    return {
      key: issuer.id,
      issuer,
      level,
      children: children.length ? children : undefined,
    };
  });

/** How far a level sits in from the one above it, and the caret's room. */
const INDENT = 28;
const CARET = 20;

const STATUSES: IssuerStatus[] = ["active", "pending", "closed", "revoked"];

/**
 * The List tab: the chains at a glance, then every CA in its hierarchy,
 * searchable and filtered by tier and status; the CAs outside the roots
 * (imported, their root left outside) beneath, apart.
 */
export function CaList({
  issuers,
  authorities,
  now,
  isAdmin,
}: {
  issuers: Issuer[];
  authorities: Map<string, DashboardAuthority>;
  now: number;
  isAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<IssuerTier>();
  const [status, setStatus] = useState<IssuerStatus>();
  const { roots, outside } = useMemo(() => groupsOf(issuers), [issuers]);
  const outsideIds = useMemo(
    () => new Set(inOrder(issuers, outside).map((p) => p.issuer.id)),
    [issuers, outside],
  );
  const parents = useMemo(
    () => issuers.filter((issuer) => childrenOf(issuers, issuer.id).length > 0),
    [issuers],
  );
  const [expanded, setExpanded] = useState<readonly Key[]>(() =>
    parents.map((issuer) => issuer.id),
  );

  const filtering = Boolean(search.trim() || tier || status);
  const matches = (issuer: Issuer) => {
    const text = search.trim().toLowerCase();
    return (
      (!tier || issuer.tier === tier) &&
      (!status || issuer.status === status) &&
      (!text ||
        issuer.id.toLowerCase().includes(text) ||
        issuer.subject.toLowerCase().includes(text))
    );
  };
  const flat = (tops: Issuer[]): Row[] =>
    inOrder(issuers, tops)
      .filter(({ issuer }) => matches(issuer))
      .map(({ issuer }) => ({ key: issuer.id, issuer, level: 0 }));
  const anchoredRows = filtering ? flat(roots) : rowsOf(issuers, roots);
  const outsideRows = filtering ? flat(outside) : rowsOf(issuers, outside);

  const live = issuers.filter((issuer) => issuer.status !== "pending");
  const anchored = live.filter((issuer) => !outsideIds.has(issuer.id)).length;
  const lists = [...authorities.values()];
  const current = lists.filter(
    (a) => a.nextUpdate && Date.parse(a.nextUpdate) > now,
  ).length;
  const active = new Set(
    issuers.filter((i) => i.status === "active").map((i) => i.id),
  );
  const online = lists.filter((a) => !a.offline && active.has(a.issuerId));
  const answering = online.filter(
    (a) => a.ocspResponderUntil && Date.parse(a.ocspResponderUntil) > now,
  ).length;

  const listLapse = (authority: DashboardAuthority) => {
    if (!authority.nextUpdate) {
      return <Typography.Text type="secondary">No list yet</Typography.Text>;
    }
    const left = Date.parse(authority.nextUpdate) - now;
    const soon = authority.offline ? left < 60 * DAY : left < 2 * DAY;
    return (
      <Typography.Text
        type={soon ? "danger" : undefined}
        className={styles.nowrap}
      >
        {left <= 0
          ? "List lapsed"
          : `List lapses in ${timeUntil(authority.nextUpdate, now)}`}
      </Typography.Text>
    );
  };
  const ocspState = (issuer: Issuer, authority: DashboardAuthority) => {
    if (authority.ocspResponderUntil || authority.ocspSoonestLapse) {
      const { color, label } = freshness(authority.ocspSoonestLapse, now);
      return <Tag color={color}>OCSP {label.toLowerCase()}</Tag>;
    }
    return issuer.offline ? null : <Tag>OCSP not answered</Tag>;
  };

  const columns: TableColumnsType<Row> = [
    {
      title: "CA",
      key: "ca",
      // Its indent and caret are drawn here, not by the table, so the caret
      // centres on the whole of what the cell says.
      render: (_, { issuer, level, children }) => (
        <Flex gap="small" align="center">
          {!filtering && (
            <span
              className={styles.caret}
              style={{ marginInlineStart: level * INDENT, width: CARET }}
            >
              {children && (
                <ExpandCaret
                  expanded={expanded.includes(issuer.id)}
                  label={shortCaName(issuer)}
                  onToggle={() =>
                    setExpanded(
                      expanded.includes(issuer.id)
                        ? expanded.filter((key) => key !== issuer.id)
                        : [...expanded, issuer.id],
                    )
                  }
                />
              )}
            </span>
          )}
          <CaIcon issuer={issuer} outside={outsideIds.has(issuer.id)} />
          <Flex vertical className={styles.shrink}>
            <Flex gap={6} align="center" wrap className={styles.tags}>
              <Link href={`/ca?id=${issuer.id}`} className={styles.shrink}>
                <Typography.Text
                  strong
                  ellipsis={{ tooltip: commonName(issuer.subject) }}
                >
                  {shortCaName(issuer)}
                </Typography.Text>
              </Link>
              <NameTags issuer={issuer} />
            </Flex>
            <Typography.Text
              type="secondary"
              className={styles.small}
              ellipsis={{ tooltip: issuer.id }}
            >
              {TIERS[issuer.tier]} · {issuer.offline ? "offline" : "online"} ·{" "}
              {issuer.id}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Certificates",
      key: "certificates",
      width: 160,
      render: (_, { issuer }) => {
        const counts = certificatesOf(authorities.get(issuer.id));
        return (
          <Flex vertical>
            <Typography.Text strong>{counts.valid} valid</Typography.Text>
            <Typography.Text
              type="secondary"
              className={`${styles.small} ${styles.nowrap}`}
            >
              {counts.expired} expired · {counts.revoked} revoked
            </Typography.Text>
          </Flex>
        );
      },
    },
    {
      title: "Valid until",
      key: "notAfter",
      width: 170,
      render: (_, { issuer }) => {
        const window = windowOf(issuer, now);
        return (
          <Flex vertical align="flex-start" gap={2}>
            <span className={styles.nowrap}>{formatDate(issuer.notAfter)}</span>
            <Tag color={window.color} className={styles.fitTag}>
              {window.label}
            </Tag>
          </Flex>
        );
      },
    },
    {
      title: "Revocation",
      key: "revocation",
      width: 190,
      render: (_, { issuer }) => {
        const authority = authorities.get(issuer.id);
        if (!authority) return "—";
        return (
          <Flex vertical align="flex-start" gap={2}>
            {listLapse(authority)}
            {ocspState(issuer, authority)}
          </Flex>
        );
      },
    },
    {
      key: "actions",
      align: "right",
      width: 170,
      render: (_, { issuer }) =>
        isAdmin &&
        issuer.offline &&
        issuer.status !== "revoked" &&
        !outsideIds.has(issuer.id) ? (
          <Link href={`/ca?id=${issuer.id}&ceremony=open`}>
            <Button size="small">
              {issuer.provedAt ? "Open a ceremony" : "Prove the backup"}
            </Button>
          </Link>
        ) : null,
    },
  ];

  const table = (rows: Row[], label: string, showHeader = true) => (
    <Table<Row>
      aria-label={label}
      showHeader={showHeader}
      tableLayout="fixed"
      size="middle"
      pagination={false}
      dataSource={rows}
      columns={columns}
      scroll={rows.length ? { x: 1000 } : undefined}
      className={styles.flushTable}
      expandable={{
        expandedRowKeys: expanded,
        onExpandedRowsChange: setExpanded,
        // The CA column draws the indent and the caret itself.
        indentSize: 0,
        expandIcon: () => null,
      }}
      locale={{
        emptyText: filtering ? "No CA matches" : "No CAs here yet",
      }}
    />
  );

  return (
    <Flex vertical>
      <Flex gap="large" align="center" wrap className={styles.bar}>
        <Flex gap="small" align="center" className={styles.nowrap}>
          <Typography.Text type="secondary">Chains</Typography.Text>
          <Progress
            className={styles.chains}
            percent={live.length ? (anchored / live.length) * 100 : 0}
            showInfo={false}
            size="small"
          />
          <Typography.Text strong>
            {anchored} of {live.length} anchored here
          </Typography.Text>
        </Flex>
        {live.length > anchored && (
          <Typography.Text type="secondary">
            {live.length - anchored} imported, their root not in Harpocrates
          </Typography.Text>
        )}
        <span className={styles.spacer} />
        <Flex gap="small" align="center">
          <Typography.Text type="secondary">Lists</Typography.Text>
          <Tag color={current === lists.length ? "green" : "red"}>
            {current} of {lists.length} current
          </Tag>
        </Flex>
        <Flex gap="small" align="center">
          <Typography.Text type="secondary">OCSP</Typography.Text>
          <Tag color={answering === online.length ? "green" : "orange"}>
            {answering} of {online.length} answering
          </Tag>
        </Flex>
      </Flex>
      <Flex gap="small" align="center" wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Search by name or ID"
          aria-label="Search the CAs"
          className={styles.search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select<IssuerTier>
          allowClear
          placeholder="All tiers"
          aria-label="Tier"
          className={styles.filter}
          value={tier}
          onChange={setTier}
          options={(Object.keys(TIERS) as IssuerTier[]).map((value) => ({
            value,
            label: TIERS[value],
          }))}
        />
        <Select<IssuerStatus>
          allowClear
          placeholder="All statuses"
          aria-label="Status"
          className={styles.filter}
          value={status}
          onChange={setStatus}
          options={STATUSES.map((value) => ({ value, label: value }))}
        />
        <span className={styles.spacer} />
        {!filtering && (
          <Button
            onClick={() =>
              setExpanded(
                expanded.length ? [] : parents.map((issuer) => issuer.id),
              )
            }
          >
            {expanded.length ? "Collapse all" : "Expand all"}
          </Button>
        )}
      </Flex>
      {table(anchoredRows, "The roots and the CAs beneath them")}
      {outsideRows.length > 0 && (
        <>
          <div className={styles.section}>
            Imported, their root not in Harpocrates
          </div>
          {table(outsideRows, "The CAs outside the roots", false)}
        </>
      )}
    </Flex>
  );
}

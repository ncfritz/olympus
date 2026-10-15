import {
  Button,
  Card,
  Flex,
  Input,
  Pagination,
  Segmented,
  Switch,
  Table,
  type TableColumnsType,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import type { CertificateLineage, Issuer } from "@/lib/api/types";
import { RENEWERS } from "@/lib/dashboard";
import { formatDate, REVOCATION_REASONS } from "@/lib/labels";
import { daysLeft, expiringByWeek, isHeld, newestOf } from "@/lib/lineages";
import { shortCaName } from "@/lib/tree";
import styles from "./Certificates.module.css";
import {
  kindOf,
  Lifeline,
  place,
  useVersionColors,
  VERSION_LABELS,
  VERSION_TAGS,
} from "./Lifeline";
import { ExpiryTag, HealthTag } from "./LineageList";

const DAY = 24 * 60 * 60 * 1000;
const MONTH = 30.44 * DAY;

/** The heat strip's weeks: the next six months. */
const WEEKS = 26;

/** The ranges the lifelines show: months behind today and ahead, or all. */
const RANGES = {
  "6 months": [3, 3],
  "18 months": [12, 6],
  All: undefined,
} as const;
type Range = keyof typeof RANGES;

type GroupBy = "CA" | "Profile" | "Renewer" | "None";

/** A page of the timeline holds this many certificates, besides its groups' headings. */
const PAGE_SIZE = 50;

/** A group's heading, as a row across the table. */
type GroupRow = { kind: "group"; key: string; label: string; count: number };
type Row = CertificateLineage | GroupRow;
const isGroup = (row: Row): row is GroupRow =>
  (row as GroupRow).kind === "group";

/** A week's colour in the heat strip: how many expire in it. */
const heatClass = (count: number) =>
  count === 0
    ? styles.heat0
    : count === 1
      ? styles.heat1
      : count === 2
        ? styles.heat2
        : styles.heat3;

/**
 * The Timeline tab: the next six months' expiries as a heat strip, then
 * each certificate's lineage on one axis, its versions end to end, its
 * renewal point marked; grouped by CA, profile or renewer. Expanded, its
 * versions as a chain of cards.
 */
export function LineageTimeline({
  lineages,
  issuers,
  now,
  onOpen,
}: {
  lineages: CertificateLineage[];
  issuers: Issuer[];
  now: number;
  onOpen: (certificateId: string) => void;
}) {
  const colors = useVersionColors();
  const [range, setRange] = useState<Range>("18 months");
  const [groupBy, setGroupBy] = useState<GroupBy>("CA");
  const [ended, setEnded] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const names = useMemo(
    () => new Map(issuers.map((i) => [i.id, shortCaName(i)])),
    [issuers],
  );
  const weeks = useMemo(
    () => expiringByWeek(lineages, now, WEEKS),
    [lineages, now],
  );

  const text = search.trim().toLowerCase();
  const shown = lineages.filter(
    (l) =>
      (ended || isHeld(l)) &&
      (!text ||
        l.name.toLowerCase().includes(text) ||
        l.names.some((n) => n.toLowerCase().includes(text))),
  );
  const hidden = lineages.length - lineages.filter(isHeld).length;

  const bounds = RANGES[range];
  const start = bounds
    ? now - bounds[0] * MONTH
    : Math.min(
        now - MONTH,
        ...shown.map((l) => Date.parse(l.versions.at(-1)!.notBefore)),
      );
  const end = bounds
    ? now + bounds[1] * MONTH
    : Math.max(
        now + MONTH,
        ...shown.map((l) => Date.parse(newestOf(l).notAfter)),
      );
  const ticks = useMemo(() => {
    const step =
      end - start > 3 * 365 * DAY ? 12 : end - start > 400 * DAY ? 3 : 1;
    const first = new Date(start);
    const out: number[] = [];
    for (
      let d = new Date(first.getFullYear(), first.getMonth() + 1, 1);
      d.getTime() < end;
      d = new Date(d.getFullYear(), d.getMonth() + step, 1)
    ) {
      out.push(d.getTime());
    }
    // A month's label too near today's would sit under it.
    return out.filter((t) => Math.abs(t - now) > (end - start) / 25);
  }, [start, end, now]);

  const keyOf = (l: CertificateLineage) =>
    groupBy === "CA"
      ? (names.get(l.issuerId) ?? l.issuerId)
      : groupBy === "Profile"
        ? (l.profileId ?? "No profile")
        : groupBy === "Renewer"
          ? RENEWERS[l.renewer]
          : "";
  const groups = new Map<string, CertificateLineage[]>();
  for (const l of [...shown].sort(
    (a, b) => daysLeft(a, now) - daysLeft(b, now),
  )) {
    groups.set(keyOf(l), [...(groups.get(keyOf(l)) ?? []), l]);
  }

  const columns: TableColumnsType<CertificateLineage> = [
    {
      title: "Certificate",
      key: "name",
      width: 300,
      render: (_, l) => (
        <Flex vertical gap={2} className={styles.shrink}>
          <Typography.Text strong ellipsis={{ tooltip: l.name }}>
            {l.name}
          </Typography.Text>
          <Flex gap={4} wrap className={styles.tags}>
            <HealthTag lineage={l} />
            <Tag>{RENEWERS[l.renewer]}</Tag>
            <Tooltip title={`${l.versions.length} versions`}>
              <Tag>v{l.versions.length}</Tag>
            </Tooltip>
          </Flex>
        </Flex>
      ),
    },
    {
      title: (
        <div className={styles.axis} aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className={styles.tick}
              style={place(t, t, start, end)}
            >
              {new Date(t).toLocaleDateString(undefined, {
                month: "short",
                year: "2-digit",
              })}
            </span>
          ))}
          <span
            className={`${styles.tick} ${styles.tickToday}`}
            style={place(now, now, start, end)}
          >
            Today
          </span>
        </div>
      ),
      key: "lifeline",
      render: (_, l) => (
        <Lifeline lineage={l} start={start} end={end} now={now} due tall />
      ),
    },
    {
      title: "Next",
      key: "next",
      width: 190,
      render: (_, l) => (
        <Flex vertical align="flex-start" gap={2} className={styles.shrink}>
          <ExpiryTag lineage={l} now={now} />
          <Typography.Text type="secondary" className={styles.small} ellipsis>
            {l.state !== "valid"
              ? "Kept a year"
              : l.health === "failing"
                ? "Its renewal is failing"
                : Date.parse(l.renewalDueAt) <= now
                  ? l.renewal === "manual"
                    ? "Due now: renew it"
                    : "Being renewed"
                  : `Renews ${formatDate(l.renewalDueAt)}`}
          </Typography.Text>
        </Flex>
      ),
    },
  ];

  // One table: each group's heading a row across it, repeated on each page
  // the group reaches, so the header stays and the rows scroll beneath it.
  const ordered = [...groups.entries()].flatMap(([group, members]) =>
    members.map((l) => ({ group, l })),
  );
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows: Row[] = [];
  let heading: string | undefined;
  for (const { group, l } of ordered.slice(
    (current - 1) * PAGE_SIZE,
    current * PAGE_SIZE,
  )) {
    if (groupBy !== "None" && group !== heading) {
      heading = group;
      rows.push({
        kind: "group",
        key: `group:${group}`,
        label: group,
        count: groups.get(group)!.length,
      });
    }
    rows.push(l);
  }
  const rowColumns: TableColumnsType<Row> = columns.map((column, index) => ({
    key: column.key,
    title: column.title as ReactNode,
    width: column.width,
    render: (value: unknown, row: Row, i: number) =>
      isGroup(row)
        ? index === 0 && (
            <span className={styles.groupRow}>
              {row.label}
              <span>
                {row.count} certificate{row.count === 1 ? "" : "s"}
              </span>
            </span>
          )
        : (
            column as {
              render: (
                v: unknown,
                l: CertificateLineage,
                i: number,
              ) => ReactNode;
            }
          ).render(value, row, i),
    onCell: (row: Row) =>
      isGroup(row) ? { colSpan: index === 0 ? columns.length : 0 } : {},
  }));

  return (
    <Flex vertical className={styles.fill}>
      <div className={styles.heatRow}>
        <div>
          <Typography.Text strong>Expiring, by week</Typography.Text>
          <div>
            <Typography.Text type="secondary" className={styles.small}>
              The next six months
            </Typography.Text>
          </div>
        </div>
        <div>
          <div
            className={styles.heat}
            role="img"
            aria-label={`Expiring each week: ${weeks.join(", ")}`}
          >
            {weeks.map((count, i) => (
              <Tooltip
                key={i}
                title={`Week of ${formatDate(new Date(now + i * 7 * DAY).toISOString())}: ${count}`}
              >
                <span
                  className={`${styles.heatCell} ${heatClass(count)} ${i === 0 && count > 0 ? styles.heatNow : ""}`}
                />
              </Tooltip>
            ))}
          </div>
          <div className={styles.heatLabels}>
            {weeks.map((_, i) => {
              const week = new Date(now + i * 7 * DAY);
              const before = new Date(now + (i - 1) * 7 * DAY);
              return (
                <Typography.Text
                  key={i}
                  type="secondary"
                  className={styles.small}
                >
                  {i === 0 || week.getMonth() !== before.getMonth()
                    ? week.toLocaleDateString(undefined, { month: "short" })
                    : ""}
                </Typography.Text>
              );
            })}
          </div>
        </div>
      </div>
      <Flex gap="small" align="center" wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Name or alternative name"
          aria-label="Search the certificates"
          className={styles.search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Segmented<GroupBy>
          aria-label="Group by"
          options={[
            { value: "CA", label: "By CA" },
            { value: "Profile", label: "By profile" },
            { value: "Renewer", label: "By renewer" },
            { value: "None", label: "Flat" },
          ]}
          value={groupBy}
          onChange={setGroupBy}
        />
        <Segmented<Range>
          aria-label="Range"
          options={Object.keys(RANGES) as Range[]}
          value={range}
          onChange={setRange}
        />
        <Flex gap="small" align="center">
          <Switch
            size="small"
            checked={ended}
            onChange={setEnded}
            aria-label="Show expired and revoked"
          />
          <Typography.Text>Expired and revoked</Typography.Text>
        </Flex>
        <span className={styles.spacer} />
        <Flex gap="middle" wrap className={styles.legend}>
          {(["current", "replaced", "revoked"] as const).map((kind) => (
            <span key={kind} className={styles.legendItem}>
              <svg width={10} height={10} aria-hidden>
                <rect width={10} height={10} rx={2} fill={colors[kind]} />
              </svg>
              {VERSION_LABELS[kind]}
            </span>
          ))}
          <span className={styles.legendItem}>
            <span className={styles.dueSwatch} />
            Renewal due
          </span>
          <span className={styles.legendItem}>
            <span className={styles.todaySwatch} />
            Today
          </span>
        </Flex>
      </Flex>
      <Table<Row>
        rowKey="key"
        size="small"
        dataSource={rows.map((row) =>
          isGroup(row) ? row : { ...row, key: row.lineageId },
        )}
        columns={rowColumns}
        pagination={false}
        tableLayout="fixed"
        scroll={rows.length ? { x: 900 } : undefined}
        className={styles.flushTable}
        rowClassName={(row) => (isGroup(row) ? styles.groupLine : "")}
        locale={{ emptyText: "No certificate matches" }}
        expandable={{
          expandRowByClick: true,
          rowExpandable: (row) => !isGroup(row),
          expandedRowRender: (row) =>
            isGroup(row) ? null : (
              <Chain lineage={row} names={names} onOpen={onOpen} />
            ),
        }}
      />
      <Pagination
        className={styles.pager}
        size="small"
        current={current}
        pageSize={PAGE_SIZE}
        total={ordered.length}
        showSizeChanger={false}
        onChange={setPage}
        showTotal={(total) =>
          `${total} certificate${total === 1 ? "" : "s"}${
            !ended && hidden > 0 ? `; ${hidden} expired or revoked, hidden` : ""
          }`
        }
      />
    </Flex>
  );
}

/** A lineage's versions as a chain of cards, oldest first. */
function Chain({
  lineage,
  names,
  onOpen,
}: {
  lineage: CertificateLineage;
  names: Map<string, string>;
  onOpen: (certificateId: string) => void;
}) {
  const oldestFirst = [...lineage.versions].reverse();
  return (
    <Flex vertical gap="small" className={styles.chainWrap}>
      <div className={styles.chain}>
        {oldestFirst.map((version, i) => {
          const kind = kindOf(version, i === oldestFirst.length - 1);
          return (
            <Fragment key={version.certificateId}>
              {i > 0 && (
                <Typography.Text type="secondary" aria-hidden>
                  →
                </Typography.Text>
              )}
              <Card
                size="small"
                className={`${styles.versionCard} ${kind === "current" ? styles.versionCardOn : ""}`}
                title={`v${i + 1}`}
                extra={
                  <Tag color={VERSION_TAGS[kind]}>{VERSION_LABELS[kind]}</Tag>
                }
              >
                <Flex vertical gap={2}>
                  <Typography.Text code>{version.serial}</Typography.Text>
                  <Typography.Text type="secondary" className={styles.small}>
                    {formatDate(version.notBefore)} →{" "}
                    {formatDate(version.notAfter)}
                  </Typography.Text>
                  <Typography.Text className={styles.small}>
                    {version.renews ? "Renewal" : "New"} ·{" "}
                    {names.get(version.issuerId) ?? version.issuerId}
                  </Typography.Text>
                  {version.revocationReason && (
                    <Typography.Text type="danger" className={styles.small}>
                      Revoked {formatDate(version.revokedAt)}:{" "}
                      {REVOCATION_REASONS[version.revocationReason]}
                    </Typography.Text>
                  )}
                  <Button
                    size="small"
                    type="link"
                    className={styles.cardLink}
                    onClick={() => onOpen(version.certificateId)}
                  >
                    Open
                  </Button>
                </Flex>
              </Card>
            </Fragment>
          );
        })}
      </div>
      <Typography.Text type="secondary" className={styles.small}>
        {lineage.names.length ? `Names: ${lineage.names.join(", ")} · ` : ""}
        {lineage.profileId ? `profile ${lineage.profileId}` : "no profile"}
        {lineage.deployTargets.length
          ? ` · deployed to ${lineage.deployTargets.join(", ")}`
          : ""}
      </Typography.Text>
    </Flex>
  );
}

import {
  Button,
  Card,
  Flex,
  Input,
  Segmented,
  Switch,
  Table,
  type TableColumnsType,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { Fragment, useMemo, useState } from "react";
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

  return (
    <Flex vertical>
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
      {[...groups.entries()].map(([group, rows], i) => (
        <Fragment key={group}>
          {groupBy !== "None" && (
            <div className={styles.section}>
              {group}
              <span>
                {rows.length} certificate{rows.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
          <Table<CertificateLineage>
            rowKey="lineageId"
            size="small"
            showHeader={i === 0}
            dataSource={rows}
            columns={columns}
            pagination={false}
            tableLayout="fixed"
            scroll={{ x: 900 }}
            className={styles.flushTable}
            expandable={{
              expandRowByClick: true,
              expandedRowRender: (l) => (
                <Chain lineage={l} names={names} onOpen={onOpen} />
              ),
            }}
          />
        </Fragment>
      ))}
      {groups.size === 0 && (
        <Typography.Text type="secondary" className={styles.padded}>
          No certificate matches.
        </Typography.Text>
      )}
      {!ended && hidden > 0 && (
        <div className={styles.section}>
          Expired and revoked: {hidden}, hidden
        </div>
      )}
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

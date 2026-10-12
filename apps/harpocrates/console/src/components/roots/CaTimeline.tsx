import { Flex, Segmented, Table, Tag, Tooltip, Typography } from "antd";
import Link from "next/link";
import { type CSSProperties, Fragment, useState } from "react";
import type {
  AttentionItem,
  DashboardAuthority,
  Issuer,
} from "@/lib/api/types";
import { formatDate } from "@/lib/labels";
import { comingUp, groupsOf, inOrder } from "@/lib/roots";
import { shortCaName } from "@/lib/tree";
import styles from "./Roots.module.css";
import { CaIcon, useTierColors } from "./shared";

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365.25 * DAY;

/** The ranges the timeline shows: years either side of today, or all. */
const RANGES = {
  "5 years": [1, 4],
  "10 years": [2, 8],
  All: undefined,
} as const;
type Range = keyof typeof RANGES;

/** A span's place on the axis, cut to it: the only values set from code. */
const span = (from: number, to: number, start: number, end: number) => {
  const a = Math.max(from, start);
  const b = Math.min(to, end);
  return {
    "--from": `${((a - start) / (end - start)) * 100}%`,
    "--width": `${(Math.max(b - a, 0) / (end - start)) * 100}%`,
  } as CSSProperties;
};

/** How deep a CA sits, and its tier's colour: set from code too. */
const rowStyle = (depth: number, color: string) =>
  ({ "--depth": depth, "--tier": color }) as CSSProperties;

const SEVERITY_COLORS = { error: "red", warning: "orange", info: "default" };

/**
 * The Timeline tab: each CA's life on one axis, in its hierarchy's order,
 * the part in which it issues in its tier's colour and the rest hatched;
 * an offline CA's next ceremony (its list lapsing) marked; today across
 * them all. Beneath, what is coming up for the CAs, soonest first.
 */
export function CaTimeline({
  issuers,
  authorities,
  attention,
  now,
}: {
  issuers: Issuer[];
  authorities: Map<string, DashboardAuthority>;
  attention: AttentionItem[];
  now: number;
}) {
  const tiers = useTierColors();
  const [range, setRange] = useState<Range>("10 years");
  const { roots, outside } = groupsOf(issuers);
  const groups = [
    { key: "roots", rows: inOrder(issuers, roots), outside: false },
    { key: "outside", rows: inOrder(issuers, outside), outside: true },
  ].map((group) => ({
    ...group,
    rows: group.rows.filter(
      ({ issuer }) => issuer.notBefore && issuer.notAfter,
    ),
  }));
  const dated = groups.flatMap((g) => g.rows.map((r) => r.issuer));

  const bounds = RANGES[range];
  const start = bounds
    ? now - bounds[0] * YEAR
    : Math.min(now, ...dated.map((i) => Date.parse(i.notBefore!)));
  const end = bounds
    ? now + bounds[1] * YEAR
    : Math.max(now + YEAR, ...dated.map((i) => Date.parse(i.notAfter!)));
  const first = new Date(start).getFullYear() + 1;
  const last = new Date(end).getFullYear();
  const step = last - first > 12 ? 5 : last - first > 6 ? 2 : 1;
  const ticks = Array.from(
    { length: Math.floor((last - first) / step) + 1 },
    (_, i) => first + i * step,
  );
  const coming = comingUp(issuers, attention, now);
  const byId = new Map(issuers.map((issuer) => [issuer.id, issuer]));

  return (
    <Flex vertical>
      <Flex
        justify="space-between"
        align="center"
        gap="middle"
        wrap
        className={styles.bar}
      >
        <Flex gap="middle" wrap className={styles.legend}>
          {(
            [
              ["Root", tiers.root],
              ["Intermediate", tiers.intermediate],
              ["Issuing CA", tiers.issuing],
              ["Outside the roots", tiers.outside],
            ] as const
          ).map(([label, color]) => (
            <span key={label} className={styles.legendItem}>
              <svg width={10} height={10} aria-hidden>
                <rect width={10} height={10} rx={2} fill={color} />
              </svg>
              {label}
            </span>
          ))}
          <span className={styles.legendItem}>
            <span className={styles.hatchSwatch} />
            Valid, no longer issues
          </span>
          <span className={styles.legendItem}>
            <span className={styles.ceremonySwatch} />
            Ceremony due: its list lapses
          </span>
          <span className={styles.legendItem}>
            <span className={styles.todaySwatch} />
            Today
          </span>
        </Flex>
        <Segmented<Range>
          options={Object.keys(RANGES) as Range[]}
          value={range}
          onChange={setRange}
          aria-label="Range"
        />
      </Flex>
      <div className={styles.timeline} role="list" aria-label="CA lifetimes">
        <div className={styles.timeRow} aria-hidden>
          <span />
          <div className={styles.axis}>
            {ticks.map((year) => (
              <span
                key={year}
                className={styles.tick}
                style={span(
                  Date.UTC(year, 0, 1),
                  Date.UTC(year, 0, 1),
                  start,
                  end,
                )}
              >
                {year}
              </span>
            ))}
          </div>
        </div>
        {groups.map((group) =>
          group.rows.length === 0 ? null : (
            <Fragment key={group.key}>
              {group.outside && (
                <div className={styles.section}>
                  Imported, their root not in Harpocrates
                </div>
              )}
              {group.rows.map(({ issuer, depth }) => {
                const from = Date.parse(issuer.notBefore!);
                const to = Date.parse(issuer.notAfter!);
                // A CA closed early stopped issuing then; today, at the latest.
                const window = issuer.issuingWindowClosesAt
                  ? Date.parse(issuer.issuingWindowClosesAt)
                  : to;
                const closes = Math.min(
                  window,
                  to,
                  issuer.status === "active" ? to : now,
                );
                const lapse = issuer.offline
                  ? authorities.get(issuer.id)?.nextUpdate
                  : undefined;
                const color = group.outside
                  ? tiers.outside
                  : tiers[issuer.tier];
                return (
                  <div
                    key={issuer.id}
                    role="listitem"
                    className={styles.timeRow}
                    style={rowStyle(depth, color)}
                  >
                    <Flex
                      gap="small"
                      align="center"
                      className={styles.timeName}
                    >
                      <CaIcon issuer={issuer} outside={group.outside} />
                      <Link
                        href={`/ca?id=${issuer.id}`}
                        className={styles.shrink}
                      >
                        <Typography.Text ellipsis={{ tooltip: issuer.id }}>
                          {shortCaName(issuer)}
                        </Typography.Text>
                      </Link>
                    </Flex>
                    <div
                      className={styles.track}
                      role="img"
                      aria-label={`${shortCaName(issuer)}: valid ${formatDate(issuer.notBefore)} to ${formatDate(issuer.notAfter)}, issues until ${formatDate(new Date(closes).toISOString())}`}
                    >
                      {ticks.map((year) => (
                        <span
                          key={year}
                          className={styles.grid}
                          style={span(
                            Date.UTC(year, 0, 1),
                            Date.UTC(year, 0, 1),
                            start,
                            end,
                          )}
                        />
                      ))}
                      <Tooltip
                        title={`Valid to ${formatDate(issuer.notAfter)}: no longer issues from ${formatDate(new Date(closes).toISOString())}`}
                      >
                        <span
                          className={`${styles.span} ${styles.hatched}`}
                          style={span(from, to, start, end)}
                        />
                      </Tooltip>
                      <Tooltip
                        title={`Issues ${formatDate(issuer.notBefore)} to ${formatDate(new Date(closes).toISOString())}`}
                      >
                        <span
                          className={`${styles.span} ${styles.issuing}`}
                          style={span(from, closes, start, end)}
                        />
                      </Tooltip>
                      {to > end && (
                        <span className={styles.beyond}>
                          → {new Date(to).getFullYear()}
                        </span>
                      )}
                      {lapse && Date.parse(lapse) < end && (
                        <Tooltip
                          title={`Its list lapses ${formatDate(lapse)}: sign the next in a ceremony before then`}
                        >
                          <span
                            className={styles.ceremony}
                            style={span(
                              Date.parse(lapse),
                              Date.parse(lapse),
                              start,
                              end,
                            )}
                          />
                        </Tooltip>
                      )}
                      <span
                        className={styles.todayLine}
                        style={span(now, now, start, end)}
                      />
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ),
        )}
      </div>
      <div className={styles.section}>Coming up</div>
      <Table
        size="middle"
        pagination={false}
        rowKey="key"
        dataSource={coming}
        className={styles.flushTable}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: "Nothing coming up for the CAs" }}
        columns={[
          {
            title: "When",
            key: "when",
            width: 140,
            render: (_, item) => (
              <Tag color={SEVERITY_COLORS[item.severity]}>
                {item.at === undefined
                  ? "Now"
                  : formatDate(new Date(item.at).toISOString())}
              </Tag>
            ),
          },
          {
            title: "CA",
            key: "ca",
            width: 240,
            render: (_, item) => {
              const issuer = byId.get(item.issuerId);
              return (
                <Link href={`/ca?id=${item.issuerId}`}>
                  {issuer ? shortCaName(issuer) : item.issuerId}
                </Link>
              );
            },
          },
          {
            title: "What",
            key: "what",
            render: (_, item) => (
              <Flex vertical>
                <Typography.Text strong>{item.title}</Typography.Text>
                <Typography.Text type="secondary" className={styles.small}>
                  {item.detail}
                </Typography.Text>
              </Flex>
            ),
          },
        ]}
      />
    </Flex>
  );
}

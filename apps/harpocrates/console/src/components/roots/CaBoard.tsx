import { RightOutlined } from "@ant-design/icons";
import {
  Breadcrumb,
  Button,
  Flex,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  DashboardAuthority,
  DashboardCertificate,
  Issuer,
} from "@/lib/api/types";
import { HEALTH, timeUntil } from "@/lib/dashboard";
import {
  CHECKS,
  type CheckState,
  checksOf,
  groupsOf,
  inOrder,
  OUTSIDE,
  TIER_PLURALS,
  windowOf,
  worstOf,
} from "@/lib/roots";
import { childrenOf, shortCaName } from "@/lib/tree";
import { CATEGORICAL, HEALTH_COLORS } from "../dashboard/chartColors";
import { baseOptions, useChartTheme } from "../dashboard/chartTheme";
import { GraphBox } from "../dashboard/GraphBox";
import styles from "./Roots.module.css";
import {
  CaIcon,
  certificatesOf,
  NameTags,
  StateTags,
  useTierColors,
} from "./shared";

/** How many columns of CAs the board shows before the chosen one's. */
const LEVELS = 3;
/** How many of a CA's certificates its column lists, soonest first. */
const SOONEST = 6;

/** A check's mark: a dot in its state's colour, named for a reader. */
const CHECK_LABELS: Record<CheckState, string> = {
  good: "Fine",
  warning: "Needs planning",
  error: "Needs a person",
  none: "Does not apply",
};

/**
 * The Board tab: three graphs (certificates by CA, valid certificates by
 * root, each CA's checks), then the CAs as columns, a root's beneath it
 * to the right, and the CA chosen last with its soonest certificates.
 */
export function CaBoard({
  issuers,
  authorities,
  certificates,
  now,
  isAdmin,
}: {
  issuers: Issuer[];
  authorities: Map<string, DashboardAuthority>;
  certificates: DashboardCertificate[];
  now: number;
  isAdmin: boolean;
}) {
  const { roots, outside } = useMemo(() => groupsOf(issuers), [issuers]);
  const ordered = useMemo(
    () => inOrder(issuers, [...roots, ...outside]).map((p) => p.issuer),
    [issuers, roots, outside],
  );

  return (
    <Flex vertical>
      <div className={styles.boardGraphs}>
        <ByCa issuers={ordered} authorities={authorities} />
        <ByRoot
          issuers={issuers}
          roots={roots}
          outside={outside}
          authorities={authorities}
        />
        <Checks issuers={ordered} authorities={authorities} now={now} />
      </div>
      <Columns
        issuers={issuers}
        roots={roots}
        outside={outside}
        authorities={authorities}
        certificates={certificates}
        now={now}
        isAdmin={isAdmin}
      />
    </Flex>
  );
}

/** Each CA's certificates, stacked: valid, expired, revoked. */
function ByCa({
  issuers,
  authorities,
}: {
  issuers: Issuer[];
  authorities: Map<string, DashboardAuthority>;
}) {
  const { token, mode } = useChartTheme();
  const rows = useMemo(
    () =>
      issuers
        .map((issuer) => ({
          name: shortCaName(issuer),
          ...certificatesOf(authorities.get(issuer.id)),
        }))
        .filter((r) => r.valid + r.expired + r.revoked > 0),
    [issuers, authorities],
  );
  const series = useMemo(
    () =>
      [
        { key: "valid", name: "Valid", color: CATEGORICAL[mode][0] },
        { key: "expired", name: "Expired", color: token.colorTextQuaternary },
        { key: "revoked", name: "Revoked", color: HEALTH_COLORS.failing },
      ] as const,
    [mode, token.colorTextQuaternary],
  );

  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: {
        ...base.chart,
        type: "bar",
        height: Math.max(120, rows.length * 30 + 40),
      },
      accessibility: {
        description: rows
          .map(
            (r) =>
              `${r.name}: ${r.valid} valid, ${r.expired} expired, ${r.revoked} revoked`,
          )
          .join("; "),
      },
      xAxis: {
        ...base.xAxis,
        categories: rows.map((r) => r.name),
        labels: {
          style: {
            color: token.colorTextSecondary,
            textOverflow: "ellipsis",
            width: 150,
          },
        },
      },
      yAxis: { ...base.yAxis, reversedStacks: false },
      tooltip: { ...base.tooltip, shared: true },
      plotOptions: {
        bar: {
          stacking: "normal",
          borderRadius: 2,
          borderWidth: 1,
          borderColor: token.colorBgContainer,
          animation: false,
          pointPadding: 0.08,
          groupPadding: 0.1,
        },
      },
      series: series.map((s) => ({
        type: "bar" as const,
        name: s.name,
        color: s.color,
        data: rows.map((r) => r[s.key]),
      })),
    };
  }, [rows, series, token]);

  return (
    <GraphBox
      title="Certificates by CA"
      extra={
        <Flex gap="middle" className={styles.legend}>
          {series.map((s) => (
            <span key={s.key} className={styles.legendItem}>
              <svg width={10} height={10} aria-hidden>
                <rect width={10} height={10} rx={2} fill={s.color} />
              </svg>
              {s.name}
            </span>
          ))}
        </Flex>
      }
    >
      {rows.length === 0 ? (
        <Typography.Text type="secondary">No certificates yet.</Typography.Text>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={options} />
      )}
    </GraphBox>
  );
}

/** The valid certificates beneath each root, and beneath none. */
function ByRoot({
  issuers,
  roots,
  outside,
  authorities,
}: {
  issuers: Issuer[];
  roots: Issuer[];
  outside: Issuer[];
  authorities: Map<string, DashboardAuthority>;
}) {
  const { token, mode } = useChartTheme();
  const tiers = useTierColors();
  const slices = useMemo(() => {
    const validUnder = (tops: Issuer[]) =>
      inOrder(issuers, tops).reduce(
        (sum, { issuer }) => sum + (authorities.get(issuer.id)?.valid ?? 0),
        0,
      );
    return [
      ...roots.map((root, i) => ({
        name: shortCaName(root),
        count: validUnder([root]),
        color: CATEGORICAL[mode][i] ?? token.colorTextTertiary,
      })),
      ...(outside.length
        ? [
            {
              name: "Outside the roots",
              count: validUnder(outside),
              color: tiers.outside,
            },
          ]
        : []),
    ];
  }, [issuers, roots, outside, authorities, mode, token, tiers.outside]);
  const total = slices.reduce((sum, s) => sum + s.count, 0);

  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: {
        ...base.chart,
        type: "pie",
        width: 140,
        height: 140,
        margin: 0,
        spacing: [0, 0, 0, 0],
      },
      title: {
        text: `<b>${total}</b><br/>valid`,
        verticalAlign: "middle",
        y: 6,
        style: { color: token.colorText, fontSize: "14px" },
      },
      accessibility: {
        description: slices.map((s) => `${s.name}: ${s.count}`).join(", "),
      },
      tooltip: {
        ...base.tooltip,
        headerFormat: "",
        pointFormat: "{point.name}: <b>{point.y}</b>",
      },
      plotOptions: {
        pie: {
          innerSize: "70%",
          dataLabels: { enabled: false },
          borderWidth: 2,
          borderColor: token.colorBgContainer,
          animation: false,
        },
      },
      series: [
        {
          type: "pie",
          name: "Valid certificates",
          data: total
            ? slices.map((s) => ({ name: s.name, y: s.count, color: s.color }))
            : [{ name: "None", y: 1, color: token.colorFillTertiary }],
          enableMouseTracking: total > 0,
        },
      ],
    };
  }, [slices, total, token]);

  return (
    <GraphBox title="Valid certificates by root">
      <Flex gap="middle" align="center" wrap>
        <div className={styles.ring}>
          <HighchartsReact highcharts={Highcharts} options={options} />
        </div>
        <Flex vertical gap={10} className={styles.ringLegend}>
          {slices.map((s) => (
            <Flex key={s.name} align="center" gap="small">
              <svg width={10} height={10} aria-hidden>
                <rect width={10} height={10} rx={2} fill={s.color} />
              </svg>
              <Typography.Text
                className={styles.grow}
                ellipsis={{ tooltip: s.name }}
              >
                {s.name}
              </Typography.Text>
              <Typography.Text strong>{s.count}</Typography.Text>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </GraphBox>
  );
}

/** Each CA's checks as a grid of dots: window, list, OCSP, backup. */
function Checks({
  issuers,
  authorities,
  now,
}: {
  issuers: Issuer[];
  authorities: Map<string, DashboardAuthority>;
  now: number;
}) {
  const colors = useStateColors();
  const rows = issuers
    .filter((issuer) => issuer.status === "active")
    .map((issuer) => ({
      issuer,
      checks: checksOf(issuer, authorities.get(issuer.id), now),
    }));
  return (
    <GraphBox
      title="Checks"
      extra={
        <Flex gap="middle" className={styles.legend}>
          {(["good", "warning", "error"] as const).map((state) => (
            <span key={state} className={styles.legendItem}>
              <Dot color={colors[state]} />
              {CHECK_LABELS[state]}
            </span>
          ))}
        </Flex>
      }
    >
      <Table
        size="small"
        pagination={false}
        rowKey={(row) => row.issuer.id}
        dataSource={rows}
        className={styles.checks}
        columns={[
          {
            title: "CA",
            key: "ca",
            ellipsis: { showTitle: true },
            render: (_, { issuer }) => (
              <Link href={`/ca?id=${issuer.id}`}>{shortCaName(issuer)}</Link>
            ),
          },
          ...CHECKS.map((check) => ({
            title: check,
            key: check,
            align: "center" as const,
            width: 60,
            render: (_: unknown, row: (typeof rows)[number]) => (
              <Tooltip title={`${check}: ${CHECK_LABELS[row.checks[check]]}`}>
                <span>
                  <Dot color={colors[row.checks[check]]} />
                </span>
              </Tooltip>
            ),
          })),
        ]}
      />
    </GraphBox>
  );
}

const useStateColors = (): Record<CheckState, string> => {
  const { token } = useChartTheme();
  return {
    good: HEALTH_COLORS.healthy,
    warning: HEALTH_COLORS.needsPerson,
    error: HEALTH_COLORS.failing,
    none: token.colorFillSecondary,
  };
};

const Dot = ({ color }: { color: string }) => (
  <svg width={10} height={10} aria-hidden>
    <circle cx={5} cy={5} r={4.5} fill={color} />
  </svg>
);

/**
 * The CAs as columns: the roots (and the CAs outside them) first, the
 * chosen one's beneath it in the next, and the last chosen shown in the
 * last column with its soonest certificates.
 */
function Columns({
  issuers,
  roots,
  outside,
  authorities,
  certificates,
  now,
  isAdmin,
}: {
  issuers: Issuer[];
  roots: Issuer[];
  outside: Issuer[];
  authorities: Map<string, DashboardAuthority>;
  certificates: DashboardCertificate[];
  now: number;
  isAdmin: boolean;
}) {
  const colors = useStateColors();
  const byId = new Map(issuers.map((issuer) => [issuer.id, issuer]));
  const beneath = (id: string): Issuer[] =>
    id === OUTSIDE ? outside : childrenOf(issuers, id);
  const firstPath = (): string[] => {
    const path: string[] = [];
    let level: Issuer[] = roots;
    while (level.length && path.length < LEVELS) {
      path.push(level[0].id);
      level = beneath(level[0].id);
    }
    return path;
  };
  const [chosen, setChosen] = useState<string[]>();
  const path = (chosen ?? firstPath()).filter(
    (id) => id === OUTSIDE || byId.has(id),
  );
  const choose = (level: number, id: string) =>
    setChosen([...path.slice(0, level), id]);
  const last = [...path].reverse().find((id) => byId.has(id));
  const shown = last ? byId.get(last) : undefined;

  const columnOf = (level: number) => {
    if (level === 0) {
      return {
        title: "Roots",
        items: roots,
        outside: outside.length > 0,
      };
    }
    const parent = path[level - 1];
    if (!parent) return undefined;
    const items = beneath(parent);
    return {
      title:
        parent === OUTSIDE
          ? "Imported"
          : items.length
            ? TIER_PLURALS[items[0].tier]
            : "Beneath it",
      items,
      outside: false,
      empty:
        byId.get(parent)?.shape === "direct"
          ? "It signs certificates itself."
          : "Nothing beneath it yet.",
    };
  };

  const item = (issuer: Issuer, level: number) => {
    const on = path[level] === issuer.id;
    const state = worstOf(checksOf(issuer, authorities.get(issuer.id), now));
    const window = windowOf(issuer, now);
    const more = beneath(issuer.id).length > 0;
    return (
      <button
        key={issuer.id}
        type="button"
        className={`${styles.item} ${on ? styles.itemOn : ""}`}
        aria-pressed={on}
        onClick={() => choose(level, issuer.id)}
      >
        <CaIcon issuer={issuer} outside={level > 0 && path[0] === OUTSIDE} />
        <Flex vertical className={styles.grow}>
          <Typography.Text strong ellipsis>
            {shortCaName(issuer)}
          </Typography.Text>
          <Typography.Text type="secondary" className={styles.small} ellipsis>
            {authorities.get(issuer.id)?.valid ?? 0} valid · {window.label}
          </Typography.Text>
        </Flex>
        <Tooltip title={CHECK_LABELS[state]}>
          <span>
            <Dot color={colors[state]} />
          </span>
        </Tooltip>
        <RightOutlined
          className={more ? styles.chevron : styles.chevronNone}
          aria-hidden
        />
      </button>
    );
  };

  const soonest = shown
    ? certificates
        .filter((c) => c.issuerId === shown.id && c.health !== "expired")
        .sort((a, b) => Date.parse(a.notAfter) - Date.parse(b.notAfter))
    : [];

  return (
    <Flex vertical>
      <div className={styles.crumbs}>
        <Breadcrumb
          items={path.map((id, level) => ({
            key: id,
            title:
              level === path.length - 1 ? (
                id === OUTSIDE ? (
                  "Outside the roots"
                ) : (
                  shortCaName(byId.get(id)!)
                )
              ) : (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setChosen(path.slice(0, level + 1));
                  }}
                >
                  {id === OUTSIDE
                    ? "Outside the roots"
                    : shortCaName(byId.get(id)!)}
                </a>
              ),
          }))}
        />
      </div>
      <div className={styles.columns}>
        {Array.from({ length: LEVELS }, (_, level) => {
          const column = columnOf(level);
          return (
            <section
              key={level}
              className={styles.column}
              aria-label={column?.title ?? "Empty"}
            >
              {column && (
                <>
                  <div className={styles.section}>
                    {column.title}
                    <span>{column.items.length || ""}</span>
                  </div>
                  {column.items.map((issuer) => item(issuer, level))}
                  {column.outside && (
                    <button
                      type="button"
                      className={`${styles.item} ${path[0] === OUTSIDE ? styles.itemOn : ""}`}
                      aria-pressed={path[0] === OUTSIDE}
                      onClick={() => choose(0, OUTSIDE)}
                    >
                      <CaIcon issuer={{ tier: "root" }} outside />
                      <Flex vertical className={styles.grow}>
                        <Typography.Text strong>
                          Outside the roots
                        </Typography.Text>
                        <Typography.Text
                          type="secondary"
                          className={styles.small}
                        >
                          {outside.length} imported, their root not here
                        </Typography.Text>
                      </Flex>
                      <RightOutlined className={styles.chevron} aria-hidden />
                    </button>
                  )}
                  {column.items.length === 0 && (
                    <Typography.Text type="secondary" className={styles.padded}>
                      {column.empty}
                    </Typography.Text>
                  )}
                </>
              )}
            </section>
          );
        })}
        <section
          className={styles.column}
          aria-label={shown ? shortCaName(shown) : "No CA chosen"}
        >
          {shown ? (
            <>
              <div className={styles.section}>{shortCaName(shown)}</div>
              <Flex vertical gap="small" className={styles.padded}>
                <Flex gap={4} wrap className={styles.tags}>
                  <NameTags issuer={shown} />
                </Flex>
                <StateTags issuer={shown} now={now} />
                <Typography.Text type="secondary">
                  {(() => {
                    const c = certificatesOf(authorities.get(shown.id));
                    return `${c.valid} valid · ${c.expired} expired · ${c.revoked} revoked`;
                  })()}
                </Typography.Text>
                <Flex gap="small" wrap>
                  <Link href={`/ca?id=${shown.id}`}>
                    <Button type="primary" size="small">
                      Open
                    </Button>
                  </Link>
                  {isAdmin && shown.offline && shown.status !== "revoked" && (
                    <Link href={`/ca?id=${shown.id}&ceremony=open`}>
                      <Button size="small">
                        {shown.provedAt
                          ? "Open a ceremony"
                          : "Prove the backup"}
                      </Button>
                    </Link>
                  )}
                </Flex>
              </Flex>
              <div className={styles.section}>
                Expiring first
                {soonest.length > SOONEST && (
                  <Link href={`/certificates?issuerId=${shown.id}`}>
                    All {soonest.length}
                  </Link>
                )}
              </div>
              {soonest.length === 0 ? (
                <Typography.Text type="secondary" className={styles.padded}>
                  No valid certificates.
                </Typography.Text>
              ) : (
                soonest.slice(0, SOONEST).map((c) => (
                  <Link
                    key={c.certificateId}
                    href={`/certificate?id=${c.certificateId}`}
                    className={styles.item}
                  >
                    <Flex vertical className={styles.grow}>
                      <Typography.Text ellipsis>{c.name}</Typography.Text>
                      <Typography.Text
                        type="secondary"
                        className={styles.small}
                      >
                        {c.profileId ?? "No profile"}
                      </Typography.Text>
                    </Flex>
                    <Tag color={HEALTH[c.health].color}>
                      {timeUntil(c.notAfter, now)}
                    </Tag>
                  </Link>
                ))
              )}
            </>
          ) : (
            <Typography.Text type="secondary" className={styles.padded}>
              Choose a CA to see it here.
            </Typography.Text>
          )}
        </section>
      </div>
    </Flex>
  );
}

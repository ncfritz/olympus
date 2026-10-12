import { Flex, theme, Typography } from "antd";
import { useMemo, useState } from "react";
import type { DashboardAuthority, Issuer } from "@/lib/api/types";
import {
  type CheckState,
  checksOf,
  layoutGraph,
  OUTSIDE,
  worstOf,
} from "@/lib/roots";
import { shortCaName } from "@/lib/tree";
import { HEALTH_COLORS } from "../dashboard/chartColors";
import { CaSummary } from "./CaSummary";
import styles from "./Roots.module.css";
import { useTierColors } from "./shared";

/** A node's size, the columns' and rows' pitch, and a group's gap. */
const W = 184;
const H = 52;
const STEP = 220;
const PITCH = 62;
const GAP = 20;

/**
 * The Graph tab: the hierarchy drawn left to right, roots first, each CA
 * a node marked with its tier and the worst of its checks, its valid
 * certificates as a bar beside it; the CAs outside the roots beneath a
 * dashed stand-in for theirs. A CA chosen is shown beside the graph.
 */
export function CaDiagram({
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
  const { token } = theme.useToken();
  const tiers = useTierColors();
  const layout = useMemo(() => layoutGraph(issuers), [issuers]);
  const states = useMemo(
    () =>
      new Map(
        issuers.map((issuer) => [
          issuer.id,
          worstOf(checksOf(issuer, authorities.get(issuer.id), now)),
        ]),
      ),
    [issuers, authorities, now],
  );
  const [chosen, setChosen] = useState<string>();
  const selected =
    issuers.find((issuer) => issuer.id === chosen) ??
    issuers.find((issuer) => states.get(issuer.id) === "error") ??
    issuers.find((issuer) => states.get(issuer.id) === "warning") ??
    issuers[0];

  const STATE_COLORS: Record<CheckState, string> = {
    good: HEALTH_COLORS.healthy,
    warning: HEALTH_COLORS.needsPerson,
    error: HEALTH_COLORS.failing,
    none: token.colorTextQuaternary,
  };
  const position = new Map(
    layout.nodes.map((node) => [
      node.id,
      {
        x: 8 + node.depth * STEP,
        y: 8 + node.row * PITCH + node.gaps * GAP,
      },
    ]),
  );
  const depth = Math.max(0, ...layout.nodes.map((n) => n.depth));
  const most = Math.max(1, ...[...authorities.values()].map((a) => a.valid));
  const width = 16 + depth * STEP + W;
  const height = 8 + layout.rows * PITCH + (layout.groups - 1) * GAP;

  return (
    <div className={styles.graphRow}>
      <section className={styles.graph} aria-label="The CAs as a graph">
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
          {(
            [
              ["Fine", STATE_COLORS.good],
              ["Needs planning", STATE_COLORS.warning],
              ["Needs a person", STATE_COLORS.error],
            ] as const
          ).map(([label, color]) => (
            <span key={label} className={styles.legendItem}>
              <svg width={10} height={10} aria-hidden>
                <circle cx={5} cy={5} r={4} fill={color} />
              </svg>
              {label}
            </span>
          ))}
          <span className={styles.legendItem}>
            <svg width={16} height={10} aria-hidden>
              <rect y={4} width={16} height={3} rx={1.5} fill={tiers.issuing} />
            </svg>
            Valid certificates, against the most
          </span>
        </Flex>
        <div className={styles.graphScroll}>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label="The hierarchy, roots on the left"
          >
            {layout.edges.map((edge) => {
              const from = position.get(edge.from)!;
              const to = position.get(edge.to)!;
              const x1 = from.x + W;
              const y1 = from.y + H / 2;
              const x2 = to.x;
              const y2 = to.y + H / 2;
              const mid = (x1 + x2) / 2;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
                  fill="none"
                  stroke={token.colorBorder}
                  strokeWidth={1.5}
                  strokeDasharray={edge.from === OUTSIDE ? "4 4" : undefined}
                />
              );
            })}
            {layout.nodes.map((node) => {
              const { x, y } = position.get(node.id)!;
              const issuer = node.issuer;
              const isSelected = issuer !== undefined && issuer === selected;
              const color = node.outside
                ? tiers.outside
                : tiers[issuer?.tier ?? "root"];
              const authority = issuer && authorities.get(issuer.id);
              const valid = authority?.valid ?? 0;
              const name = issuer ? shortCaName(issuer) : "Root outside";
              const note = issuer
                ? `${issuer.offline ? "offline" : "online"} · ${valid} valid`
                : "Not in Harpocrates";
              return (
                <g
                  key={node.id}
                  role={issuer ? "button" : undefined}
                  tabIndex={issuer ? 0 : undefined}
                  aria-label={issuer ? name : undefined}
                  aria-pressed={issuer ? isSelected : undefined}
                  className={issuer ? styles.node : undefined}
                  onClick={() => issuer && setChosen(issuer.id)}
                  onKeyDown={(e) => {
                    if (issuer && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setChosen(issuer.id);
                    }
                  }}
                >
                  <title>
                    {issuer
                      ? `${name}: ${note}`
                      : "Their root, not in Harpocrates"}
                  </title>
                  <rect
                    x={x}
                    y={y}
                    width={W}
                    height={H}
                    rx={6}
                    fill={
                      issuer
                        ? token.colorBgContainer
                        : token.colorFillQuaternary
                    }
                    stroke={isSelected ? token.colorPrimary : token.colorBorder}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray={issuer ? undefined : "5 4"}
                  />
                  <rect x={x} y={y} width={4} height={H} rx={2} fill={color} />
                  <text
                    x={x + 14}
                    y={y + 20}
                    fontSize={12.5}
                    fontWeight={600}
                    fill={token.colorText}
                  >
                    {name.length > 24 ? `${name.slice(0, 23)}…` : name}
                  </text>
                  <text
                    x={x + 14}
                    y={y + 36}
                    fontSize={11}
                    fill={token.colorTextSecondary}
                  >
                    {note}
                  </text>
                  {issuer && (
                    <circle
                      cx={x + W - 12}
                      cy={y + 12}
                      r={4}
                      fill={STATE_COLORS[states.get(issuer.id) ?? "none"]}
                    />
                  )}
                  {issuer && valid > 0 && (
                    <rect
                      x={x + 14}
                      y={y + H - 7}
                      width={(valid / most) * (W - 28)}
                      height={3}
                      rx={1.5}
                      fill={tiers.issuing}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <Typography.Text type="secondary" className={styles.small}>
          Choose a CA to see it beside the graph. The dashed root is outside
          Harpocrates: importing it anchors its CAs here.
        </Typography.Text>
      </section>
      {selected && (
        <CaSummary
          issuer={selected}
          issuers={issuers}
          authority={authorities.get(selected.id)}
          now={now}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

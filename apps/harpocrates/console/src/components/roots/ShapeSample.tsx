import { Flex, theme, Typography } from "antd";
import type { IssuerShape, IssuerTier } from "@/lib/api/types";
import { SHAPES } from "@/lib/labels";
import styles from "./Roots.module.css";
import { useTierColors } from "./shared";

/** A CA's node, and a certificate's (smaller), as the Graph tab draws them. */
const W = 184;
const H = 52;
const LEAF_W = 150;
const LEAF_H = 36;
const STEP = 220;
const PITCH = 52;

type SampleNode = {
  id: string;
  name: string;
  note: string;
  tier: IssuerTier | "leaf";
  children?: SampleNode[];
};

const leaves = (from: string, n: number): SampleNode[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${from}-leaf-${i}`,
    name: `Certificate ${i + 1}`,
    note: "a server, a service, a device",
    tier: "leaf",
  }));

const issuing = (n: number, leafCount = 2): SampleNode => ({
  id: `issuing-${n}`,
  name: `Issuing CA ${n}`,
  note: "online · signs certificates",
  tier: "issuing",
  children: leaves(`issuing-${n}`, leafCount),
});

/** Each shape's sample: what it will sign, with placeholder names. */
const SAMPLES: Record<IssuerShape, SampleNode> = {
  three_tier: {
    id: "root",
    name: "Root CA",
    note: "offline · signs intermediates",
    tier: "root",
    children: [
      {
        id: "intermediate-1",
        name: "Intermediate CA 1",
        note: "offline · signs issuing CAs",
        tier: "intermediate",
        children: [issuing(1)],
      },
      {
        id: "intermediate-2",
        name: "Intermediate CA 2",
        note: "offline · signs issuing CAs",
        tier: "intermediate",
        children: [issuing(2), issuing(3)],
      },
    ],
  },
  two_tier: {
    id: "root",
    name: "Root CA",
    note: "offline · signs issuing CAs",
    tier: "root",
    children: [issuing(1), issuing(2)],
  },
  direct: {
    id: "root",
    name: "Root CA",
    note: "offline · signs in ceremonies",
    tier: "root",
    children: leaves("root", 4),
  },
};

type Placed = SampleNode & { depth: number; row: number };

/** Left to right, a row to each leaf, a parent level with its children's middle. */
const layout = (root: SampleNode) => {
  const nodes: Placed[] = [];
  const edges: { from: Placed; to: Placed }[] = [];
  let next = 0;
  const place = (node: SampleNode, depth: number): Placed => {
    const children = (node.children ?? []).map((c) => place(c, depth + 1));
    const row = children.length
      ? (children[0].row + children[children.length - 1].row) / 2
      : next++;
    const placed = { ...node, depth, row };
    nodes.push(placed);
    children.forEach((to) => edges.push({ from: placed, to }));
    return placed;
  };
  place(root, 0);
  return { nodes, edges, rows: next };
};

/**
 * What a root of this shape will sign, drawn as the roots page's Graph
 * tab draws a hierarchy: left to right, each CA a node marked with its
 * tier, and the certificates the issuing CAs (or the root itself) sign
 * as smaller nodes at the end. The names are placeholders.
 */
export function ShapeSample({ shape }: { shape: IssuerShape }) {
  const { token } = theme.useToken();
  const tiers = useTierColors();
  const { nodes, edges, rows } = layout(SAMPLES[shape]);
  const depth = Math.max(...nodes.map((n) => n.depth));
  const width = 16 + depth * STEP + LEAF_W;
  const height = 16 + (rows - 1) * PITCH + H;
  const colorOf = (tier: SampleNode["tier"]) =>
    tier === "leaf" ? token.colorTextQuaternary : tiers[tier];
  const boxOf = (node: Placed) => {
    const leaf = node.tier === "leaf";
    const w = leaf ? LEAF_W : W;
    const h = leaf ? LEAF_H : H;
    return {
      x: 8 + node.depth * STEP,
      y: 8 + node.row * PITCH + (H - h) / 2,
      w,
      h,
    };
  };
  const legend = [
    ["Root", tiers.root],
    ...(shape === "three_tier" ? [["Intermediate", tiers.intermediate]] : []),
    ...(shape === "direct" ? [] : [["Issuing CA", tiers.issuing]]),
    ["Certificate", token.colorTextQuaternary],
  ] as [string, string][];

  return (
    <section
      className={styles.sample}
      aria-label={`${SHAPES[shape].label}: a sample hierarchy`}
    >
      <Flex gap="middle" wrap className={styles.legend}>
        {legend.map(([label, color]) => (
          <span key={label} className={styles.legendItem}>
            <svg width={10} height={10} aria-hidden>
              <rect width={10} height={10} rx={2} fill={color} />
            </svg>
            {label}
          </span>
        ))}
      </Flex>
      <div className={styles.graphScroll}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${SHAPES[shape].label}, root on the left`}
        >
          {edges.map(({ from, to }) => {
            const a = boxOf(from);
            const b = boxOf(to);
            const x1 = a.x + a.w;
            const y1 = a.y + a.h / 2;
            const x2 = b.x;
            const y2 = b.y + b.h / 2;
            const mid = (x1 + x2) / 2;
            return (
              <path
                key={`${from.id}-${to.id}`}
                d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
                fill="none"
                stroke={token.colorBorder}
                strokeWidth={1.5}
              />
            );
          })}
          {nodes.map((node) => {
            const { x, y, w, h } = boxOf(node);
            const leaf = node.tier === "leaf";
            return (
              <g key={node.id}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={6}
                  fill={
                    leaf ? token.colorFillQuaternary : token.colorBgContainer
                  }
                  stroke={token.colorBorder}
                />
                <rect
                  x={x}
                  y={y}
                  width={4}
                  height={h}
                  rx={2}
                  fill={colorOf(node.tier)}
                />
                <text
                  x={x + 14}
                  y={leaf ? y + 22 : y + 20}
                  fontSize={leaf ? 11.5 : 12.5}
                  fontWeight={leaf ? 400 : 600}
                  fill={token.colorText}
                >
                  {node.name}
                </text>
                {!leaf && (
                  <text
                    x={x + 14}
                    y={y + 36}
                    fontSize={11}
                    fill={token.colorTextSecondary}
                  >
                    {node.note}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <Typography.Text type="secondary" className={styles.small}>
        A sample: the names are placeholders, and how many of each it has is up
        to you.
      </Typography.Text>
    </section>
  );
}

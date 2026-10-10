"use client";

import { Flex, Tag, Tree, Typography } from "antd";
import Link from "next/link";
import type { Issuer } from "@/lib/api/types";
import { STATUS_COLORS, TIERS } from "@/lib/labels";
import { childrenOf, commonName } from "@/lib/tree";

interface Node {
  key: string;
  title: React.ReactNode;
  children: Node[];
}

const nodeOf = (issuers: Issuer[], issuer: Issuer): Node => ({
  key: issuer.id,
  title: (
    <Flex gap="small" align="center" wrap>
      <Link href={`/ca?id=${issuer.id}`}>{commonName(issuer.subject)}</Link>
      <Typography.Text type="secondary">{TIERS[issuer.tier]}</Typography.Text>
      <Tag color={STATUS_COLORS[issuer.status]}>{issuer.status}</Tag>
      {issuer.offline && <Tag>offline</Tag>}
    </Flex>
  ),
  children: childrenOf(issuers, issuer.id).map((child) =>
    nodeOf(issuers, child),
  ),
});

/** The CAs beneath a root, as a tree; none yet says so. */
export function IssuerTree({
  issuers,
  rootId,
}: {
  issuers: Issuer[];
  rootId: string;
}) {
  const nodes = childrenOf(issuers, rootId).map((child) =>
    nodeOf(issuers, child),
  );
  if (nodes.length === 0) {
    return (
      <Typography.Text type="secondary">
        Nothing beneath it yet.
      </Typography.Text>
    );
  }
  return <Tree treeData={nodes} defaultExpandAll selectable={false} showLine />;
}

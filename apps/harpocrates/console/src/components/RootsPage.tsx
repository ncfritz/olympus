"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Row,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useCurrentUser, useIssuers } from "@/lib/api/queries";
import type { Issuer } from "@/lib/api/types";
import { formatDate, SHAPES, STATUS_COLORS, windowClosed } from "@/lib/labels";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";
import { IssuerTree } from "./IssuerTree";

/**
 * The roots (ADR 0032): each a trust anchor of its own, with its shape,
 * whether its key's backup is proved, and the CAs beneath it.
 */
export function RootsPage() {
  const { data: issuers, error, isLoading } = useIssuers();
  const { isAdmin } = useCurrentUser();
  const roots = (issuers ?? []).filter((issuer) => issuer.tier === "root");

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <div>
          <Typography.Title level={3}>Roots</Typography.Title>
          <Typography.Text type="secondary">
            Each root anchors only what is beneath it: trusting one says nothing
            of another.
          </Typography.Text>
        </div>
        <Link href="/roots/new">
          <Button type="primary" icon={<PlusOutlined />} disabled={!isAdmin}>
            New root
          </Button>
        </Link>
      </Flex>
      <ErrorAlert error={error} title="The CAs could not be listed" />
      {!isLoading && roots.length === 0 && !error && (
        <Empty description="No roots yet. Harpocrates starts empty in production: create the first one." />
      )}
      <Row gutter={[16, 16]}>
        {roots.map((root) => (
          <Col key={root.id} xs={24} xl={12}>
            <RootCard root={root} issuers={issuers ?? []} />
          </Col>
        ))}
      </Row>
    </Flex>
  );
}

function RootCard({ root, issuers }: { root: Issuer; issuers: Issuer[] }) {
  const shape = root.shape ? SHAPES[root.shape] : undefined;
  const discarded = Boolean(root.discardedAt);
  return (
    <Card
      title={<Link href={`/ca?id=${root.id}`}>{commonName(root.subject)}</Link>}
      extra={
        <Flex gap="small">
          {shape && <Tag color="blue">{shape.label}</Tag>}
          {!discarded && windowClosed(root) && (
            <Tag color="orange">no longer signs</Tag>
          )}
          <Tag color={STATUS_COLORS[root.status]}>
            {discarded ? "discarded" : root.status}
          </Tag>
        </Flex>
      }
    >
      <Flex vertical gap="middle">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Subject">
            <Typography.Text code>{root.subject}</Typography.Text>
          </Descriptions.Item>
          {shape && (
            <Descriptions.Item label="Signs">{shape.signs}</Descriptions.Item>
          )}
          <Descriptions.Item label="Expires">
            {formatDate(root.notAfter)}
          </Descriptions.Item>
          <Descriptions.Item label="Key backup">
            {root.provedAt ? (
              `Proved ${formatDate(root.provedAt)}`
            ) : discarded ? (
              "—"
            ) : (
              <Typography.Text type="warning">
                Not proved: its first ceremony proves it
              </Typography.Text>
            )}
          </Descriptions.Item>
        </Descriptions>
        {!discarded && <IssuerTree issuers={issuers} rootId={root.id} />}
        {!discarded && (
          <Flex gap="small" wrap>
            <Link href={`/ceremonies/new?issuerId=${root.id}`}>
              <Button>
                {root.provedAt ? "Open a ceremony" : "Prove the backup"}
              </Button>
            </Link>
            <Link href={`/ca?id=${root.id}`}>
              <Button type="link">Details</Button>
            </Link>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

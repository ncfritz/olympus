import {
  BulbOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  PartitionOutlined,
} from "@ant-design/icons";
import type {
  DescribeMailClusterResponse,
  MailCluster,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  List,
  message,
  Popconfirm,
  Progress,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useState } from "react";
import mailApi from "../../../../api/mailApi";
import { useFetch } from "../../../../hooks/useFetch";
import { apiProblems } from "../../../../utils/goals";
import {
  applyText,
  purityText,
  reviewHref,
  suggestionText,
} from "../../../../utils/mailClusters";
import { applyCluster } from "./applyCluster";

const { Text } = Typography;

export interface ClusterPanelProps {
  /** The selected cluster, if any. */
  cluster?: MailCluster;
  /** The clusters that suggest something, largest first. */
  worthALook: MailCluster[];
  onSelect: (clusterId: string) => void;
  /** Drops the selection. */
  onClear: () => void;
}

/**
 * The Clusters page's side panel: the selected cluster's label mix and
 * purity, top senders, newest messages and the suggestion it leads to;
 * then the clusters worth a look.
 */
const ClusterPanel: React.FunctionComponent<ClusterPanelProps> = ({
  cluster,
  worthALook,
  onSelect,
  onClear,
}) => {
  const [busy, setBusy] = useState(false);
  const [detail, loading] = useFetch<
    { clusterId?: string },
    DescribeMailClusterResponse | undefined
  >({
    dataType: "mail cluster",
    params: { clusterId: cluster?.id },
    watch: [cluster?.id],
    validateOptions: (p) => !!p.clusterId,
    fetchFunction: async (p) =>
      (await mailApi.describeCluster(p.clusterId as string)).data,
  });

  const apply = async (c: MailCluster) => {
    setBusy(true);
    try {
      const messages = await applyCluster(c);
      message.success(
        <span>
          Writing {c.proposedName} to {messages.toLocaleString()} messages in
          Gmail.{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  const suggestion = cluster ? suggestionText(cluster) : undefined;
  const shown = detail?.cluster.id === cluster?.id ? detail : undefined;

  return (
    <Flex vertical={true} gap={16}>
      <Card
        size={"small"}
        title={cluster ? cluster.name : "A cluster"}
        extra={
          cluster && (
            <Tooltip title={"Clear the selection (Esc)"}>
              <Button
                type={"text"}
                size={"small"}
                icon={<CloseOutlined />}
                aria-label={"Clear the selection"}
                onClick={onClear}
              />
            </Tooltip>
          )
        }
      >
        {!cluster ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"Select a dot or a cluster's name on the map."}
          />
        ) : (
          <Flex vertical={true} gap={12}>
            <Descriptions size={"small"} column={1}>
              <Descriptions.Item label={"Messages"}>
                {cluster.size.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={"Groups"}>
                {cluster.scope === "label"
                  ? `${cluster.scopeLabel}'s mail`
                  : "Unlabelled mail"}
              </Descriptions.Item>
              <Descriptions.Item label={"Purity"}>
                {purityText(cluster)}
              </Descriptions.Item>
            </Descriptions>
            {cluster.labels.length > 0 && (
              <div>
                <Text strong={true}>Label mix</Text>
                {cluster.labels.map((l) => (
                  <Flex key={l.label} align={"center"} gap={8}>
                    <Text ellipsis={true} style={{ width: 140 }}>
                      {l.label}
                    </Text>
                    <Progress
                      percent={Math.round((100 * l.messages) / cluster.size)}
                      size={"small"}
                      style={{ margin: 0, flex: 1 }}
                    />
                  </Flex>
                ))}
              </div>
            )}
            <div>
              <Text strong={true}>Top senders</Text>
              {cluster.senders.map((s) => (
                <Flex key={s.sender} justify={"space-between"} gap={8}>
                  <Text ellipsis={true}>{s.sender}</Text>
                  <Text type={"secondary"}>{s.messages.toLocaleString()}</Text>
                </Flex>
              ))}
            </div>
            {suggestion && (
              <Card size={"small"} type={"inner"}>
                <Space direction={"vertical"} size={8}>
                  <Space>
                    {cluster.suggestion === "split" ? (
                      <PartitionOutlined />
                    ) : (
                      <BulbOutlined />
                    )}
                    <Text strong={true}>{suggestion}</Text>
                  </Space>
                  <Space wrap={true}>
                    <Popconfirm
                      title={
                        cluster.suggestion === "split"
                          ? `Move to ${cluster.proposedName}?`
                          : `Create ${cluster.proposedName}?`
                      }
                      description={applyText(cluster)}
                      okText={"Apply"}
                      onConfirm={() => apply(cluster)}
                    >
                      <Button
                        type={"primary"}
                        icon={<CloudUploadOutlined />}
                        loading={busy}
                      >
                        {cluster.suggestion === "split"
                          ? "Create sub-label"
                          : "Create label"}
                      </Button>
                    </Popconfirm>
                    <Link href={reviewHref(cluster)}>Re-classification</Link>
                  </Space>
                </Space>
              </Card>
            )}
            <div>
              <Text strong={true}>Newest messages</Text>
              {loading && !shown ? (
                <Flex justify={"center"}>
                  <Spin />
                </Flex>
              ) : (
                <List
                  size={"small"}
                  dataSource={shown?.messages ?? []}
                  renderItem={(m) => (
                    <List.Item>
                      <Flex vertical={true} style={{ minWidth: 0 }}>
                        <Text ellipsis={true}>
                          {m.subject ?? "(no subject)"}
                        </Text>
                        <Text type={"secondary"} ellipsis={true}>
                          {m.fromAddress} ·{" "}
                          {DateTime.fromISO(m.receivedTime).toLocaleString(
                            DateTime.DATE_MED,
                          )}
                        </Text>
                        <Space size={2} wrap={true}>
                          {m.labels.map((l) => (
                            <Tag key={l}>{l}</Tag>
                          ))}
                        </Space>
                      </Flex>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Flex>
        )}
      </Card>
      <Card size={"small"} title={"Worth a look"}>
        {worthALook.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"Nothing suggests a new label or a split."}
          />
        ) : (
          <List
            size={"small"}
            dataSource={worthALook}
            renderItem={(c) => (
              <List.Item
                actions={[
                  <Button
                    key={"show"}
                    type={"link"}
                    size={"small"}
                    onClick={() => onSelect(c.id)}
                    aria-label={`Show ${c.name} on the map`}
                  >
                    Show
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={6}>
                      {c.suggestion === "split" ? (
                        <PartitionOutlined />
                      ) : (
                        <BulbOutlined />
                      )}
                      <span>{c.proposedName}</span>
                    </Space>
                  }
                  description={`${c.size.toLocaleString()} messages · ${
                    c.suggestion === "split"
                      ? `split from ${c.scopeLabel}`
                      : c.name
                  }`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Flex>
  );
};

export default ClusterPanel;

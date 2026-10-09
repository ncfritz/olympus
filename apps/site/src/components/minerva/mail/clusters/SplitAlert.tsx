import { PartitionOutlined } from "@ant-design/icons";
import type {
  ListMailClusterSuggestionsResponse,
  MailCluster,
} from "@ncfritz/olympus-sdk/minerva";
import { Alert, Button, Flex, message, Popconfirm, Space, Tag } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import mailApi from "../../../../api/mailApi";
import { useFetch } from "../../../../hooks/useFetch";
import { apiProblems } from "../../../../utils/goals";
import { clusterHref } from "../../../../utils/mailClusters";
import { applyCluster } from "./applyCluster";

export interface SplitAlertProps {
  /** The label under review, by full name. */
  label?: string;
}

/**
 * A label's review's split alert (design.md): where the clustering found
 * the label's mail in groups from different senders, the proposed
 * sub-labels and their counts, with Preview (the map, on the group) and
 * Create sub-labels (each group moved into its own). Nothing shows
 * without a split.
 */
const SplitAlert: React.FunctionComponent<SplitAlertProps> = ({ label }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [found, , , refresh] = useFetch<
    { label?: string },
    ListMailClusterSuggestionsResponse | undefined
  >({
    dataType: "split suggestions",
    params: { label },
    watch: [label],
    quiet: true,
    validateOptions: (p) => !!p.label,
    fetchFunction: async (p) =>
      (await mailApi.listClusterSuggestions(p.label)).data,
  });
  const groups: MailCluster[] =
    label && found ? found.clusters.filter((c) => c.scopeLabel === label) : [];
  if (!groups.length) return null;
  const total = groups.reduce((n, c) => n + c.size, 0);

  const create = async () => {
    setBusy(true);
    try {
      let messages = 0;
      for (const c of groups) messages += await applyCluster(c);
      message.success(
        <span>
          Moving {messages.toLocaleString()} messages into{" "}
          {groups.length.toLocaleString()} sub-labels in Gmail.{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
      await refresh(true);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert
      type={"warning"}
      showIcon={true}
      icon={<PartitionOutlined />}
      style={{ marginBottom: 12 }}
      message={`${label} holds ${groups.length} kinds of mail from different senders`}
      description={
        <Flex justify={"space-between"} align={"center"} wrap={true} gap={8}>
          <Space size={4} wrap={true}>
            {groups.map((c) => (
              <Link key={c.id} href={clusterHref(c)}>
                <Tag>
                  {c.proposedName} · {c.size.toLocaleString()}
                </Tag>
              </Link>
            ))}
          </Space>
          <Space wrap={true}>
            <Button onClick={() => void router.push(clusterHref(groups[0]))}>
              Preview
            </Button>
            <Popconfirm
              title={`Create ${groups.length} sub-labels?`}
              description={`Creates each sub-label in Gmail and moves its group's messages into it from ${label}, ${total.toLocaleString()} in all. The rest of ${label} stays. It can be undone from the change log.`}
              okText={"Create sub-labels"}
              onConfirm={create}
            >
              <Button type={"primary"} loading={busy}>
                Create sub-labels
              </Button>
            </Popconfirm>
          </Space>
        </Flex>
      }
    />
  );
};

export default SplitAlert;

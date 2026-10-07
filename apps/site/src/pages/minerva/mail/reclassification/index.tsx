import { ReloadOutlined, TagsOutlined } from "@ant-design/icons";
import type {
  GetMailAuditResponse,
  ListMailClusterSuggestionsResponse,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Card,
  Empty,
  Flex,
  message,
  Space,
  Spin,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import mailApi from "../../../../api/mailApi";
import AuditStrip from "../../../../components/minerva/mail/audit/AuditStrip";
import ExportButton from "../../../../components/minerva/mail/audit/ExportButton";
import LabelTreeTable from "../../../../components/minerva/mail/audit/LabelTreeTable";
import MergeCandidates from "../../../../components/minerva/mail/audit/MergeCandidates";
import MixedThreads from "../../../../components/minerva/mail/audit/MixedThreads";
import StarMismatches from "../../../../components/minerva/mail/audit/StarMismatches";
import StarsPanel from "../../../../components/minerva/mail/audit/StarsPanel";
import MailBreadcrumbs from "../../../../components/minerva/mail/MailBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";
import { splitsByLabel } from "../../../../utils/mailClusters";

const { Title, Text } = Typography;

/**
 * Re-classification (docs/plans/email-management phase 2): the audit's
 * findings over the mail, read-only. Proposed changes per label with a
 * review of each, merge candidates, threads whose messages disagree, and
 * stars. Applying changes to Gmail comes with phase 4.
 */
const MailReclassificationPage: React.FunctionComponent = () => {
  const [running, setRunning] = useState(false);
  const [audit, loading, , refresh] = useFetch<
    Record<string, never>,
    GetMailAuditResponse | undefined
  >({
    dataType: "mail audit",
    params: {},
    watch: [],
    fetchFunction: async () => (await mailApi.getAudit()).data,
  });

  const run = async () => {
    setRunning(true);
    try {
      await mailApi.runAudit();
      await refresh(false);
      message.success("Audit finished");
    } catch {
      message.error("The audit could not run");
    } finally {
      setRunning(false);
    }
  };

  // The clustering's split suggestions (phase 6), for the strip and flags.
  const [suggestions] = useFetch<
    Record<string, never>,
    ListMailClusterSuggestionsResponse | undefined
  >({
    dataType: "split suggestions",
    params: {},
    watch: [],
    quiet: true,
    fetchFunction: async () => (await mailApi.listClusterSuggestions()).data,
  });
  const splits = useMemo(
    () => splitsByLabel(suggestions?.clusters ?? []),
    [suggestions],
  );

  const summary = audit?.summary;
  const runButton = (
    <Button
      type={summary ? "default" : "primary"}
      icon={<ReloadOutlined />}
      loading={running}
      onClick={run}
    >
      {summary ? "Run again" : "Run the audit"}
    </Button>
  );

  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <TagsOutlined />
            <span>Re-classification</span>
          </Space>,
        ]}
      />
      <div
        style={{
          height: "calc(100vh - 92px)",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <Flex
          justify={"space-between"}
          align={"center"}
          wrap={true}
          gap={12}
          style={{ padding: 16 }}
        >
          <Space align={"baseline"} size={12}>
            <Title level={3} style={{ margin: 0 }}>
              Re-classification
            </Title>
            <Text type={"secondary"} style={{ fontSize: 15 }}>
              {summary
                ? `Audited ${DateTime.fromISO(summary.finishedTime).toRelative()} · ${summary.messagesExamined.toLocaleString()} messages, ${summary.consistentSenders.toLocaleString()} consistent senders · ${
                    summary.classifierFinishedTime
                      ? `${summary.classifierChanges.toLocaleString()} from the classifier, ${DateTime.fromISO(summary.classifierFinishedTime).toRelative()}`
                      : "the classifier has not run"
                  }`
                : "What the audit finds in your labels"}
            </Text>
          </Space>
          <Space size={8}>
            {summary && (
              <Link href={"/minerva/mail/reclassification/label"}>
                All proposed changes
              </Link>
            )}
            {summary && <ExportButton />}
            {runButton}
          </Space>
        </Flex>
        {loading && !audit ? (
          <Flex justify={"center"} style={{ padding: 48 }}>
            <Spin />
          </Flex>
        ) : !audit || !summary ? (
          <Empty
            style={{ padding: 48 }}
            description={
              <Space direction={"vertical"}>
                <Text>Your mail has not been audited yet.</Text>
                <Text type={"secondary"}>
                  The audit reads only what is stored, changes nothing in Gmail,
                  and takes a few seconds.
                </Text>
              </Space>
            }
          >
            {runButton}
          </Empty>
        ) : (
          <>
            <AuditStrip
              summary={summary}
              highConfidence={audit.highConfidence}
              splits={{
                labels: splits.size,
                groups: [...splits.values()].reduce((n, s) => n + s.groups, 0),
              }}
            />
            <Flex vertical={true} gap={16} style={{ padding: 16 }}>
              <Card size={"small"} title={"Labels"}>
                <LabelTreeTable labels={audit.labels} splits={splits} />
              </Card>
              <Card size={"small"} title={"Merge candidates"}>
                <MergeCandidates
                  merges={audit.merges}
                  labels={audit.labels.map((l) => l.name)}
                />
              </Card>
              <Card
                size={"small"}
                title={"Threads with mixed labels"}
                extra={<Text type={"secondary"}>The largest 50</Text>}
              >
                <MixedThreads threads={audit.threads} />
              </Card>
              <Card size={"small"} title={"Stars"}>
                <StarsPanel stars={audit.stars} />
              </Card>
              <Card size={"small"} title={"Stars and states disagree"}>
                <StarMismatches />
              </Card>
            </Flex>
          </>
        )}
      </div>
    </>
  );
};

export default MailReclassificationPage;

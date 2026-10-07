import { DotChartOutlined } from "@ant-design/icons";
import type {
  GetMailClusterMapResponse,
  ListMailAccountsResponse,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import React, { useCallback, useMemo } from "react";
import mailApi from "../../../api/mailApi";
import ClusterMap from "../../../components/minerva/mail/clusters/ClusterMap";
import ClusterPanel from "../../../components/minerva/mail/clusters/ClusterPanel";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { worthALook } from "../../../utils/mailClusters";

const { Title, Text } = Typography;

/**
 * Clusters (docs/plans/email-management phase 6; design.md): the mailbox
 * as a map, a dot per about 50 messages placed by similarity and coloured
 * by label, its clusters named; the side panel shows the selected cluster
 * and the suggestion it leads to, then the clusters worth a look. The
 * selected cluster and the mailbox are in the address (`?cluster=`,
 * `?accountId=`), so the label review's split alert can link here.
 */
const MailClustersPage: React.FunctionComponent = () => {
  const router = useRouter();
  const selectedId =
    typeof router.query.cluster === "string" ? router.query.cluster : undefined;
  const accountId =
    typeof router.query.accountId === "string"
      ? router.query.accountId
      : undefined;

  const [accounts] = useFetch<object, ListMailAccountsResponse | undefined>({
    dataType: "mail accounts",
    params: {},
    fetchFunction: async () => (await mailApi.listAccounts()).data,
  });

  const [map, loading] = useFetch<
    { accountId?: string; ready: boolean },
    GetMailClusterMapResponse | undefined
  >({
    dataType: "mail clusters",
    params: { accountId, ready: router.isReady },
    watch: [accountId, router.isReady],
    validateOptions: (p) => p.ready,
    fetchFunction: async (p) => (await mailApi.getClusterMap(p.accountId)).data,
  });

  const setQuery = useCallback(
    (changes: Record<string, string | undefined>) => {
      const query = { ...router.query, ...changes };
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) delete query[k];
      }
      void router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
      });
    },
    [router],
  );
  const select = useCallback(
    (clusterId: string) => setQuery({ cluster: clusterId }),
    [setQuery],
  );

  const clusters = useMemo(() => map?.clusters ?? [], [map]);
  const selected = clusters.find((c) => c.id === selectedId);
  const run = map?.run;
  const shownAccount = accountId ?? run?.accountId;

  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <DotChartOutlined />
            <span>Clusters</span>
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
              Clusters
            </Title>
            <Text type={"secondary"} style={{ fontSize: 15 }}>
              {run?.finishedTime
                ? `${clusters.length.toLocaleString()} clusters over ${(
                    run.messages ?? 0
                  ).toLocaleString()} messages, ${DateTime.fromISO(
                    run.finishedTime,
                  ).toRelative()}`
                : "Your mail, grouped by what it is about"}
            </Text>
          </Space>
          {(accounts?.accounts.length ?? 0) > 1 && (
            <Select
              style={{ width: 260 }}
              value={shownAccount}
              placeholder={"Mailbox"}
              options={accounts?.accounts.map((a) => ({
                label: a.email,
                value: a.id,
              }))}
              onChange={(v: string) =>
                setQuery({ accountId: v, cluster: undefined })
              }
            />
          )}
        </Flex>
        <div style={{ padding: "0 16px 16px" }}>
          {loading && !map ? (
            <Flex justify={"center"} style={{ padding: 48 }}>
              <Spin />
            </Flex>
          ) : !run ? (
            <Empty
              style={{ padding: 48 }}
              description={
                "No clusters yet. The classifier groups the mail each night once the archive has embeddings."
              }
            />
          ) : (
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={16}>
                <Card size={"small"}>
                  <Spin spinning={loading}>
                    <ClusterMap
                      clusters={clusters}
                      points={map?.points ?? []}
                      selectedId={selected?.id}
                      onSelect={select}
                    />
                  </Spin>
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <ClusterPanel
                  cluster={selected}
                  worthALook={worthALook(clusters)}
                  onSelect={select}
                />
              </Col>
            </Row>
          )}
        </div>
      </div>
    </>
  );
};

export default MailClustersPage;

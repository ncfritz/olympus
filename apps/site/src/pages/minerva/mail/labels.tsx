import { BulbOutlined, PlusOutlined, SettingOutlined } from "@ant-design/icons";
import type {
  CreateMailLabelFamilyRequest,
  MailLabel,
  MailLabelFamily,
  MailLabelKind,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  message,
  Row,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import React, { useMemo, useState } from "react";
import mailApi from "../../../api/mailApi";
import FamilyCard from "../../../components/minerva/mail/labels/FamilyCard";
import NewFamilyModal from "../../../components/minerva/mail/labels/NewFamilyModal";
import RetireButton from "../../../components/minerva/mail/labels/RetireButton";
import StateTag from "../../../components/minerva/mail/labels/StateTag";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import {
  type SuggestedFamily,
  suggestFamilies,
} from "../../../utils/mailLabels";

const { Title, Text } = Typography;

const KIND_COLORS: Record<MailLabelKind, string | undefined> = {
  topical: undefined,
  state: "gold",
  system: "default",
  retired: "volcano",
};

type Data = { labels: MailLabel[]; families: MailLabelFamily[] };

/**
 * Labels (ADR 0030, Label kinds; docs/plans/email-management phase 3):
 * what each label is to the classifier. Families of state labels, with
 * those the names suggest; and every label's kind, with retiring one into
 * another. Changes here are Olympus's own; nothing is written to Gmail.
 */
const MailLabelsPage: React.FunctionComponent = () => {
  const [kind, setKind] = useState<MailLabelKind | "all">("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<{
    open: boolean;
    suggestion?: SuggestedFamily;
  }>({ open: false });

  const [data, loading, , refresh] = useFetch<Record<string, never>, Data>({
    dataType: "mail labels",
    params: {},
    watch: [],
    default: { labels: [], families: [] },
    fetchFunction: async () => {
      const [labels, families] = await Promise.all([
        mailApi.listLabels(),
        mailApi.listFamilies(),
      ]);
      return {
        labels: labels.data.labels,
        families: families.data.families,
      };
    },
  });

  const suggestions = useMemo(
    () =>
      suggestFamilies(
        data.labels,
        data.families.map((f) => f.name),
      ),
    [data],
  );
  const shown = useMemo(
    () =>
      data.labels.filter(
        (l) =>
          (kind === "all" || l.kind === kind) &&
          l.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [data.labels, kind, search],
  );

  const act = async (what: () => Promise<unknown>, done: string) => {
    try {
      await what();
      message.success(done);
      await refresh(true);
    } catch (e) {
      const text = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      message.error(text ?? "That did not work");
    }
  };

  const create = async (request: CreateMailLabelFamilyRequest) => {
    await act(
      () => mailApi.createFamily(request),
      `The ${request.name} family is set up`,
    );
    setCreating({ open: false });
  };

  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <SettingOutlined />
            <span>Labels</span>
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
          style={{ padding: 16 }}
        >
          <Space align={"baseline"} size={12}>
            <Title level={3} style={{ margin: 0 }}>
              Labels
            </Title>
            <Text type={"secondary"} style={{ fontSize: 15 }}>
              What each label is to the classifier
            </Text>
          </Space>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setCreating({ open: true })}
          >
            New family
          </Button>
        </Flex>
        {loading && data.labels.length === 0 ? (
          <Flex justify={"center"} style={{ padding: 48 }}>
            <Spin />
          </Flex>
        ) : (
          <Flex vertical={true} gap={16} style={{ padding: "0 16px 16px" }}>
            <Card
              size={"small"}
              title={"Families"}
              extra={
                <Text type={"secondary"}>
                  The classifier predicts a family; mail enters at its initial
                  state
                </Text>
              }
            >
              <Flex vertical={true} gap={12}>
                {suggestions.map((s) => (
                  <Alert
                    key={s.name}
                    type={"info"}
                    showIcon={true}
                    icon={<BulbOutlined />}
                    message={
                      <Space wrap={true} size={4}>
                        <Text>Your labels suggest a {s.name} family:</Text>
                        {s.states.map((state) => (
                          <StateTag
                            key={state.labelId}
                            name={state.name}
                            open={state.open}
                            initial={state.labelId === s.initialLabelId}
                          />
                        ))}
                      </Space>
                    }
                    action={
                      <Space>
                        <Button
                          size={"small"}
                          onClick={() =>
                            setCreating({ open: true, suggestion: s })
                          }
                        >
                          Adjust…
                        </Button>
                        <Button
                          size={"small"}
                          type={"primary"}
                          onClick={() =>
                            create({
                              name: s.name,
                              states: s.states.map(({ labelId, open }) => ({
                                labelId,
                                open,
                              })),
                              initialLabelId: s.initialLabelId,
                              transitions: s.transitions,
                            })
                          }
                        >
                          Create
                        </Button>
                      </Space>
                    }
                  />
                ))}
                {data.families.length === 0 && suggestions.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={"No families yet."}
                  />
                ) : (
                  <Row gutter={[12, 12]}>
                    {data.families.map((f) => (
                      <Col key={f.id} xs={24} lg={12} xxl={8}>
                        <FamilyCard
                          family={f}
                          onDelete={() =>
                            act(
                              () => mailApi.deleteFamily(f.id),
                              `The ${f.name} family is gone`,
                            )
                          }
                        />
                      </Col>
                    ))}
                  </Row>
                )}
              </Flex>
            </Card>
            <Card
              size={"small"}
              title={"All labels"}
              extra={
                <Space size={12} wrap={true}>
                  <Input.Search
                    allowClear={true}
                    placeholder={"Search"}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 220 }}
                  />
                  <Segmented
                    value={kind}
                    onChange={(v) => setKind(v as MailLabelKind | "all")}
                    options={[
                      { label: "All", value: "all" },
                      { label: "Topical", value: "topical" },
                      { label: "States", value: "state" },
                      { label: "Retired", value: "retired" },
                      { label: "System", value: "system" },
                    ]}
                  />
                </Space>
              }
            >
              <Table<MailLabel>
                size={"small"}
                rowKey={"id"}
                loading={loading}
                dataSource={shown}
                pagination={{ pageSize: 50, showSizeChanger: false }}
                columns={[
                  { title: "Label", dataIndex: "name" },
                  {
                    title: "Kind",
                    dataIndex: "kind",
                    width: 110,
                    render: (k: MailLabelKind) => (
                      <Tag color={KIND_COLORS[k]}>{k}</Tag>
                    ),
                  },
                  {
                    title: "Messages",
                    dataIndex: "messages",
                    align: "right",
                    width: 110,
                    sorter: (a, b) => a.messages - b.messages,
                    render: (n: number) => n.toLocaleString(),
                  },
                  {
                    title: "Family or target",
                    key: "detail",
                    render: (_, l) =>
                      l.kind === "state" ? (
                        <Text>
                          {l.familyName} · {l.stateOpen ? "open" : "closed"}
                        </Text>
                      ) : l.kind === "retired" ? (
                        <Text>merges into {l.mergeTargetName}</Text>
                      ) : null,
                  },
                  {
                    title: "",
                    key: "actions",
                    width: 130,
                    render: (_, l) =>
                      l.kind === "topical" ? (
                        <RetireButton
                          label={l}
                          labels={data.labels}
                          onRetire={(target) =>
                            act(
                              () =>
                                mailApi.updateLabel(l.id, {
                                  kind: "retired",
                                  mergeTargetId: target,
                                }),
                              `${l.name} is retired`,
                            )
                          }
                        />
                      ) : l.kind === "retired" ? (
                        <Button
                          size={"small"}
                          type={"link"}
                          onClick={() =>
                            act(
                              () =>
                                mailApi.updateLabel(l.id, { kind: "topical" }),
                              `${l.name} is in use again`,
                            )
                          }
                        >
                          Make topical
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </Card>
          </Flex>
        )}
      </div>
      <NewFamilyModal
        open={creating.open}
        labels={data.labels}
        suggestion={creating.suggestion}
        onCancel={() => setCreating({ open: false })}
        onCreate={create}
      />
    </>
  );
};

export default MailLabelsPage;

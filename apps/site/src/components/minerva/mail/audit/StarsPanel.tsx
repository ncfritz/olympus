import { SearchOutlined } from "@ant-design/icons";
import type {
  MailStarLabel,
  MailStarMixed,
  MailStarSender,
  MailStarStatistics,
} from "@ncfritz/olympus-sdk/minerva";
import { Col, Flex, Row, Statistic, Table, theme, Typography } from "antd";
import type { FilterDropdownProps } from "antd/lib/table/interface";
import React from "react";
import { Mono, TextFilterDropdown } from "../MailCells";

const { Text } = Typography;

const count = (n: number) => <Mono>{n.toLocaleString()}</Mono>;

const AGES: Record<string, string> = {
  month: "Starred, this month",
  year: "Starred, this year",
  older: "Starred, older",
};

/** Whether a filter's term is in a value, ignoring case. */
const contains = (value: unknown, text: string | undefined) =>
  String(text ?? "")
    .toLowerCase()
    .includes(String(value).toLowerCase());

/** A text column's filter: what it should contain, searched for. */
const useSearchColumn = () => {
  const { token } = theme.useToken();
  return (placeholder: string) => ({
    filterIcon: (on: boolean) => (
      <SearchOutlined style={on ? { color: token.colorPrimary } : undefined} />
    ),
    filterDropdown: (p: FilterDropdownProps) => (
      <TextFilterDropdown {...p} placeholder={placeholder} />
    ),
  });
};

/**
 * Stars over the mail: how old the starred mail is (an old star is often
 * an attention star never cleared), and where stars gather, by label and
 * by sender, each sortable and searchable. Takeout keeps no star icon, so
 * these are stars of any kind until the account is linked.
 */
const StarsPanel: React.FunctionComponent<{ stars: MailStarStatistics }> = ({
  stars,
}) => {
  const search = useSearchColumn();
  return (
    <Row gutter={[16, 16]}>
      {stars.ages.map((a) => (
        <Col key={a.age} xs={8}>
          <Statistic title={AGES[a.age] ?? a.age} value={a.starred} />
        </Col>
      ))}
      <Col xs={24} xl={12}>
        <Text strong={true}>By label</Text>
        <Table<MailStarLabel>
          size={"small"}
          rowKey={"name"}
          pagination={false}
          dataSource={stars.labels}
          locale={{ emptyText: "No starred mail under a label." }}
          columns={[
            {
              title: "Label",
              dataIndex: "name",
              sorter: (a, b) => a.name.localeCompare(b.name),
              onFilter: (v, r) => contains(v, r.name),
              ...search("Label name"),
            },
            {
              title: "Starred",
              dataIndex: "starred",
              align: "right",
              sorter: (a, b) => a.starred - b.starred,
              render: count,
            },
            {
              title: "Of",
              dataIndex: "messages",
              align: "right",
              sorter: (a, b) => a.messages - b.messages,
              render: count,
            },
          ]}
        />
      </Col>
      <Col xs={24} xl={12}>
        <Text strong={true}>By sender</Text>
        <Table<MailStarSender>
          size={"small"}
          rowKey={"address"}
          pagination={false}
          dataSource={stars.senders}
          locale={{ emptyText: "No starred mail." }}
          columns={[
            {
              title: "Sender",
              dataIndex: "address",
              sorter: (a, b) => a.address.localeCompare(b.address),
              onFilter: (v, r) => contains(v, r.address),
              ...search("Sender address"),
            },
            {
              title: "Starred",
              dataIndex: "starred",
              align: "right",
              sorter: (a, b) => a.starred - b.starred,
              render: count,
            },
            {
              title: "Of",
              dataIndex: "messages",
              align: "right",
              sorter: (a, b) => a.messages - b.messages,
              render: count,
            },
          ]}
        />
      </Col>
    </Row>
  );
};

/** Mail from one sender with the same subject but its numbers, starred and not. */
export const StarsAlike: React.FunctionComponent<{
  stars: MailStarStatistics;
}> = ({ stars }) => (
  <Flex vertical={true} gap={8}>
    <Text type={"secondary"}>
      Mail from one sender with the same subject but for its numbers, some of it
      starred and some not.
    </Text>
    <Table<MailStarMixed>
      size={"small"}
      rowKey={(r) => `${r.address}\u0000${r.subjectPattern}`}
      pagination={false}
      dataSource={stars.mixed}
      locale={{ emptyText: "Stars are consistent." }}
      columns={[
        { title: "Sender", dataIndex: "address" },
        { title: "Subject", dataIndex: "subjectPattern" },
        {
          title: "Starred",
          dataIndex: "starred",
          align: "right",
          render: count,
        },
        {
          title: "Of",
          dataIndex: "messages",
          align: "right",
          render: count,
        },
      ]}
    />
  </Flex>
);

export default StarsPanel;

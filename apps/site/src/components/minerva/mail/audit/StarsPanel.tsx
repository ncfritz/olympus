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
import tableStyles from "../MailTable.module.css";

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
    <div className={tableStyles.column} style={{ gap: 16 }}>
      <Row gutter={16} style={{ flex: "none" }}>
        {stars.ages.map((a) => (
          <Col key={a.age} xs={8}>
            <Statistic title={AGES[a.age] ?? a.age} value={a.starred} />
          </Col>
        ))}
      </Row>
      <Flex gap={16} style={{ flex: 1, minHeight: 0 }}>
        <div className={tableStyles.column} style={{ minWidth: 0 }}>
          <Text strong={true}>By label</Text>
          <div className={tableStyles.fill}>
            <Table<MailStarLabel>
              size={"small"}
              rowKey={"name"}
              pagination={false}
              scroll={{ y: 1 }}
              dataSource={stars.labels}
              locale={{ emptyText: "No starred mail under a label." }}
              columns={[
                {
                  title: "Label",
                  dataIndex: "name",
                  ellipsis: true,
                  sorter: (a, b) => a.name.localeCompare(b.name),
                  onFilter: (v, r) => contains(v, r.name),
                  ...search("Label name"),
                },
                {
                  title: "Starred",
                  dataIndex: "starred",
                  align: "right",
                  width: 100,
                  sorter: (a, b) => a.starred - b.starred,
                  render: count,
                },
                {
                  title: "Of",
                  dataIndex: "messages",
                  align: "right",
                  width: 100,
                  sorter: (a, b) => a.messages - b.messages,
                  render: count,
                },
              ]}
            />
          </div>
        </div>
        <div className={tableStyles.column} style={{ minWidth: 0 }}>
          <Text strong={true}>By sender</Text>
          <div className={tableStyles.fill}>
            <Table<MailStarSender>
              size={"small"}
              rowKey={"address"}
              pagination={false}
              scroll={{ y: 1 }}
              dataSource={stars.senders}
              locale={{ emptyText: "No starred mail." }}
              columns={[
                {
                  title: "Sender",
                  dataIndex: "address",
                  ellipsis: true,
                  sorter: (a, b) => a.address.localeCompare(b.address),
                  onFilter: (v, r) => contains(v, r.address),
                  ...search("Sender address"),
                },
                {
                  title: "Starred",
                  dataIndex: "starred",
                  align: "right",
                  width: 100,
                  sorter: (a, b) => a.starred - b.starred,
                  render: count,
                },
                {
                  title: "Of",
                  dataIndex: "messages",
                  align: "right",
                  width: 100,
                  sorter: (a, b) => a.messages - b.messages,
                  render: count,
                },
              ]}
            />
          </div>
        </div>
      </Flex>
    </div>
  );
};

/** Mail from one sender with the same subject but its numbers, starred and not. */
export const StarsAlike: React.FunctionComponent<{
  stars: MailStarStatistics;
}> = ({ stars }) => (
  <div className={tableStyles.column}>
    <Text type={"secondary"}>
      Mail from one sender with the same subject but for its numbers, some of it
      starred and some not.
    </Text>
    <div className={tableStyles.fill}>
      <Table<MailStarMixed>
        size={"small"}
        rowKey={(r) => `${r.address}\u0000${r.subjectPattern}`}
        pagination={false}
        dataSource={stars.mixed}
        scroll={{ y: 1 }}
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
    </div>
  </div>
);

export default StarsPanel;

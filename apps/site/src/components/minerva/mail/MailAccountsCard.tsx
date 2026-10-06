import { EditOutlined, GoogleOutlined, LinkOutlined } from "@ant-design/icons";
import type { MailAccount } from "@ncfritz/olympus-sdk/minerva";
import { Button, Card, List, Space, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";

const { Text } = Typography;

const MODIFY = "https://www.googleapis.com/auth/gmail.modify";

/** Whether the mailbox's link lets Olympus change labels in Gmail. */
export const canChangeLabels = (a: MailAccount): boolean =>
  Boolean(a.linkScope?.split(" ").includes(MODIFY));

/**
 * The user's mailboxes and whether each is linked to Gmail (phase 1b):
 * linking is what lets Minerva keep a mailbox up to date, and later write
 * reviewed changes back.
 */
const MailAccountsCard: React.FunctionComponent<{
  accounts: MailAccount[];
  loading?: boolean;
  onConnect: (account: MailAccount) => void;
}> = ({ accounts, loading, onConnect }) => (
  <Card size={"small"} title={"Mailboxes"} style={{ width: "100%" }}>
    <List<MailAccount>
      loading={loading}
      dataSource={accounts}
      locale={{ emptyText: "No mailbox imported yet." }}
      renderItem={(a) => (
        <List.Item
          actions={[
            a.linkedTime && !canChangeLabels(a) ? (
              <Button
                key={"allow"}
                size={"small"}
                type={"primary"}
                icon={<EditOutlined />}
                onClick={() => onConnect(a)}
              >
                Allow changes
              </Button>
            ) : (
              <Button
                key={"connect"}
                size={"small"}
                type={a.linkedTime ? "default" : "primary"}
                icon={<GoogleOutlined />}
                onClick={() => onConnect(a)}
              >
                {a.linkedTime ? "Sign in again" : "Link to Gmail"}
              </Button>
            ),
          ]}
        >
          <List.Item.Meta
            title={a.email}
            description={
              <Space size={8} wrap={true}>
                {a.linkedTime ? (
                  <>
                    <Tag icon={<LinkOutlined />} color={"green"}>
                      Linked{" "}
                      {DateTime.fromISO(a.linkedTime).toLocaleString(
                        DateTime.DATE_MED,
                      )}
                    </Tag>
                    <Tag color={canChangeLabels(a) ? "blue" : undefined}>
                      {canChangeLabels(a) ? "Can change labels" : "Read only"}
                    </Tag>
                  </>
                ) : (
                  <Tag>Not linked</Tag>
                )}
                <Text type={"secondary"}>
                  {a.verification === "import"
                    ? `Imported from Takeout ${DateTime.fromISO(a.verifiedTime).toLocaleString(DateTime.DATE_MED)}`
                    : "Signed in from Olympus"}
                </Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  </Card>
);

export default MailAccountsCard;

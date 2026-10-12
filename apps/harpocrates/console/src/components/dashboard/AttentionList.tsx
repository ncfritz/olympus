import { CheckCircleOutlined } from "@ant-design/icons";
import { Card, Flex, Tag, Typography } from "antd";
import Link from "next/link";
import type { AttentionItem } from "@/lib/api/types";
import { attentionHref, timeUntil } from "@/lib/dashboard";
import styles from "./Dashboard.module.css";

/** What needs a person, errors first, then soonest first. */
export function AttentionList({
  items,
  now,
}: {
  items: AttentionItem[];
  now: number;
}) {
  return (
    <Card
      title="Needs a person"
      extra={items.length > 0 && <Tag>{items.length}</Tag>}
      classNames={{ body: items.length ? styles.flushBody : undefined }}
    >
      {items.length === 0 ? (
        <Flex gap="small" align="center">
          <Typography.Text type="success">
            <CheckCircleOutlined />
          </Typography.Text>
          <Typography.Text>Nothing needs you.</Typography.Text>
        </Flex>
      ) : (
        <Flex vertical>
          {items.map((item) => (
            <Flex
              key={`${item.kind}:${item.subjectId}`}
              gap="middle"
              align="flex-start"
              className={styles.attention}
            >
              <Tag
                color={item.severity === "error" ? "red" : "orange"}
                className={styles.when}
              >
                {item.dueAt
                  ? timeUntil(item.dueAt, now)
                  : item.severity === "error"
                    ? "Now"
                    : "Soon"}
              </Tag>
              <Flex vertical className={styles.shrink}>
                <Link href={attentionHref(item)}>{item.title}</Link>
                <Typography.Paragraph
                  type="secondary"
                  className={styles.detail}
                  ellipsis={{ rows: 3, tooltip: item.detail }}
                >
                  {item.detail}
                </Typography.Paragraph>
              </Flex>
            </Flex>
          ))}
        </Flex>
      )}
    </Card>
  );
}

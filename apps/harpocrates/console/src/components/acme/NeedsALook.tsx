import {
  CheckCircleOutlined,
  CloseCircleFilled,
  ExclamationCircleFilled,
  InfoCircleFilled,
} from "@ant-design/icons";
import { Button, Flex, Typography } from "antd";
import type { LookItem } from "@/lib/acme";
import styles from "./Acme.module.css";

/** A severity's mark: an icon and its colour, never colour alone. */
const MARK: Record<LookItem["severity"], React.ReactNode> = {
  error: (
    <Typography.Text type="danger" aria-label="Failing">
      <CloseCircleFilled />
    </Typography.Text>
  ),
  warning: (
    <Typography.Text type="warning" aria-label="Needs doing">
      <ExclamationCircleFilled />
    </Typography.Text>
  ),
  info: (
    <Typography.Text className={styles.infoMark} aria-label="For information">
      <InfoCircleFilled />
    </Typography.Text>
  ),
};

/**
 * What needs a look, worst first: clients failing, credentials never
 * bound, clients renewing now. Each opens its client in the list.
 */
export function NeedsALook({
  items,
  onOpen,
}: {
  items: LookItem[];
  onOpen: (credentialId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Flex gap="small" align="center">
        <Typography.Text type="success">
          <CheckCircleOutlined />
        </Typography.Text>
        <Typography.Text>Every client is renewing on time.</Typography.Text>
      </Flex>
    );
  }
  return (
    <Flex vertical>
      <Typography.Title level={5}>Needs a look</Typography.Title>
      {items.map((item) => (
        <Flex
          key={item.key}
          gap="small"
          align="flex-start"
          className={styles.look}
        >
          {MARK[item.severity]}
          <Flex vertical gap={4} className={styles.shrink}>
            <Typography.Text strong>{item.title}</Typography.Text>
            <Typography.Text>{item.detail}</Typography.Text>
            <Typography.Text type="secondary" className={styles.small}>
              {item.hint}
            </Typography.Text>
            <span>
              <Button size="small" onClick={() => onOpen(item.credentialId)}>
                Open the client
              </Button>
            </span>
          </Flex>
        </Flex>
      ))}
    </Flex>
  );
}

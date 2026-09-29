import { DatabaseOutlined } from "@ant-design/icons";
import { Badge, Space, Typography } from "antd";

/** How many notifications a group holds at each level. */
type NotificationLevelCounts = {
  info?: number;
  success?: number;
  warning?: number;
  error?: number;
};

export interface NotificationGroupHeaderProps {
  notificationStatistics: Record<string, NotificationLevelCounts>;
  unreadCount: number;
  group: any;
}

const NotificationGroupHeader: React.FunctionComponent<
  NotificationGroupHeaderProps
> = ({
  notificationStatistics,
  unreadCount,
  group,
}: NotificationGroupHeaderProps) => {
  return (
    <Typography.Title
      level={5}
      style={{
        marginLeft: 16,
        marginRight: 16,
        lineHeight: 1.5,
        paddingBottom: 8,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: "row",
      }}
    >
      <Space size={8} style={{ width: "100%" }}>
        <DatabaseOutlined />
        <Badge
          color={unreadCount > 0 ? "red" : "#666666"}
          count={unreadCount}
          offset={[-12, -16]}
          showZero={true}
        />
        {group.name}
      </Space>
      <Space.Compact>
        <Typography.Text
          style={{
            alignContent: "center",
            fontSize: 12,
            fontWeight: "lighter",
            whiteSpace: "nowrap",
            background: "#e3efff",
            color: "#1677ff",
            paddingRight: 8,
            paddingLeft: 12,
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
          }}
        >
          {notificationStatistics[group.id]?.info || 0}
        </Typography.Text>
        <Typography.Text
          style={{
            alignContent: "center",
            fontSize: 12,
            fontWeight: "lighter",
            whiteSpace: "nowrap",
            background: "#e8ffdd",
            color: "#52c41a",
            paddingRight: 8,
            paddingLeft: 8,
          }}
        >
          {notificationStatistics[group.id]?.success || 0}
        </Typography.Text>
        <Typography.Text
          style={{
            alignContent: "center",
            fontSize: 12,
            fontWeight: "lighter",
            whiteSpace: "nowrap",
            background: "#fff2d7",
            color: "#faad14",
            paddingRight: 8,
            paddingLeft: 8,
          }}
        >
          {notificationStatistics[group.id]?.warning || 0}
        </Typography.Text>
        <Typography.Text
          style={{
            alignContent: "center",
            fontSize: 12,
            fontWeight: "lighter",
            whiteSpace: "nowrap",
            background: "#ffdede",
            color: "#ff4d4f",
            padding: 4,
            paddingRight: 12,
            paddingLeft: 8,
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          {notificationStatistics[group.id]?.error || 0}
        </Typography.Text>
      </Space.Compact>
    </Typography.Title>
  );
};
export default NotificationGroupHeader;

import {
  ExperimentOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Flex, Tabs } from "antd";
import NotificationForm from "./NotificationForm";
import NotificationsList from "./NotificationsList";
import NotificationSettings from "./NotificationsSettings";

const NotificationsPanel: React.FunctionComponent = () => {
  return (
    <Flex vertical={true} style={{ height: "100%" }}>
      <Flex
        vertical={true}
        style={{ height: "100%", justifyContent: "space-between" }}
      >
        <Tabs
          defaultActiveKey="notifications-tabs-list"
          tabBarStyle={{
            paddingLeft: 16,
          }}
          items={[
            {
              key: "notifications-tabs-list",
              label: "List",
              icon: <UnorderedListOutlined />,
              children: <NotificationsList />,
            },
            {
              key: "notifications-tabs-settings",
              label: "Settings",
              icon: <SettingOutlined />,
              children: <NotificationSettings />,
            },
            {
              key: "notifications-tabs-lab",
              label: "Labs",
              icon: <ExperimentOutlined />,
              children: <NotificationForm />,
            },
          ]}
        />
      </Flex>
    </Flex>
  );
};
export default NotificationsPanel;

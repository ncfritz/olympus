import {
  ClockCircleOutlined,
  HomeOutlined,
  SubnodeOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Menu } from "antd";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAppSelector } from "../../../redux/hooks";

const BASE_PATH = "tools";
const SUB_MENUS = {
  "/security": "security-container",
  "/time": "time-container",
  "/encoding": "encoding_container",
  "/general": "general_container",
};

const ToolsMenu: React.FunctionComponent = () => {
  const router = useRouter();

  const submenuExpanded = useAppSelector(
    (state) => state.layout.submenuExpanded,
  );

  const [sideMenuItem, setSideMenuItem] = useState<string>("/");
  const [sideMenuSubMenuItems, setSideMenuSubMenuItems] = useState<string[]>(
    [],
  );

  useEffect(() => {
    const path = router.pathname;
    const items = [];

    for (const [key, value] of Object.entries(SUB_MENUS)) {
      if (path.startsWith(`/${BASE_PATH}${key}`)) {
        items.push(value);
      }
    }

    setSideMenuSubMenuItems(items);
    setSideMenuItem(path);
  }, [router]);

  const updateSubMenus = ({ key }: { key: string }) => {
    const items = [...sideMenuSubMenuItems];

    if (items.indexOf(key) > -1) {
      items.splice(items.indexOf(key), 1);
    } else {
      items.push(key);
    }

    setSideMenuSubMenuItems(items);
  };

  return (
    <Menu
      style={{
        width: submenuExpanded ? 300 : 80,
      }}
      theme={"light"}
      defaultSelectedKeys={["/"]}
      selectedKeys={[sideMenuItem]}
      openKeys={sideMenuSubMenuItems}
      mode={"inline"}
      onSelect={({ item, key, keyPath, selectedKeys, domEvent }) => {
        setSideMenuItem(key);
        router.push(key, key, { shallow: true });
      }}
      items={[
        {
          key: `/${BASE_PATH}`,
          icon: <HomeOutlined />,
          label: "Home",
        },
        {
          key: `/${BASE_PATH}/uuid`,
          icon: <HomeOutlined />,
          label: "UUID",
        },
        {
          key: "security-container",
          icon: <ToolOutlined />,
          label: "Metadata",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/security/sslcon`,
              icon: <ToolOutlined />,
              label: "SSL Connection Tester",
            },
            {
              key: `/${BASE_PATH}/security/certv`,
              icon: <ToolOutlined />,
              label: "Certificate Viewer",
            },
            {
              key: `/${BASE_PATH}/security/sslmon`,
              icon: <ToolOutlined />,
              label: "Certificate Monitor",
            },
          ],
        },
        {
          key: "time-container",
          icon: <ClockCircleOutlined />,
          label: "Content",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/time/zones`,
              icon: <ClockCircleOutlined />,
              label: "Timezones",
            },
            {
              key: `/${BASE_PATH}/content/ts`,
              icon: <ClockCircleOutlined />,
              label: "Timestamp",
            },
          ],
        },
        {
          key: "encoding_container",
          icon: <SubnodeOutlined />,
          label: "Encoding",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/encoding/jwt`,
              icon: <SubnodeOutlined />,
              label: "JWT Tokens",
            },
            {
              key: `/${BASE_PATH}/encoding/base`,
              icon: <SubnodeOutlined />,
              label: "Base64/62",
            },
            {
              key: `/${BASE_PATH}/encoding/json`,
              icon: <SubnodeOutlined />,
              label: "JSON Formatter",
            },
            {
              key: `/${BASE_PATH}/encoding/char`,
              icon: <SubnodeOutlined />,
              label: "Character",
            },
          ],
        },
        {
          key: "general_container",
          icon: <SubnodeOutlined />,
          label: "General",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/encoding/jwt`,
              icon: <SubnodeOutlined />,
              label: "JWT Tokens",
            },
          ],
        },
      ]}
    />
  );
};
export default ToolsMenu;

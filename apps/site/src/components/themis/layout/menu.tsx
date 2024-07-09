import {
  BarChartOutlined,
  CalendarOutlined,
  FolderAddOutlined,
  FolderOutlined,
  HomeOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Avatar, Menu, Space, Spin, Typography } from "antd";
import type { ItemType, MenuItemType } from "antd/es/menu/interface";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { GetReviewYearsResponse } from "../../../pages/api/themis/reviewYears";

const BASE_PATH = "themis";

const ThemisMenu: React.FunctionComponent = () => {
  const router = useRouter();

  const [sideMenuItem, setSideMenuItem] = useState<string>("/");
  const [sideMenuSubMenuItems, setSideMenuSubMenuItems] = useState<string[]>(
    [],
  );
  const [reviewYears, setReviewYears] = useState<
    GetReviewYearsResponse | undefined
  >(undefined);
  const [reviewYearsLoading, setReviewYearsLoading] = useState(false);
  const [reviewYearsError, setReviewYearsError] = useState(false);

  useEffect(() => {
    (async () => {
      setReviewYearsLoading(true);
      setReviewYearsError(false);

      try {
        const response = await themisApi.getReviewYears();
        setReviewYears(response);
      } catch (e) {
        setReviewYearsError(true);
      } finally {
        setReviewYearsLoading(false);
      }
    })();
  }, []);

  const updateSubMenus = ({ key }: { key: string }) => {
    const items = [...sideMenuSubMenuItems];

    if (items.indexOf(key) > -1) {
      items.splice(items.indexOf(key), 1);
    } else {
      items.push(key);
    }

    setSideMenuSubMenuItems(items);
  };

  if (reviewYearsLoading) {
    return (
      <Space
        size={8}
        direction={"vertical"}
        style={{ marginTop: 64, alignItems: "center", width: "100%" }}
      >
        <Spin size="large" />
        <Typography.Text>Loading...</Typography.Text>
      </Space>
    );
  } else if (reviewYearsError) {
    return <></>;
  }

  const menuItems: ItemType<MenuItemType>[] = [];

  if (reviewYears && reviewYears.reviews) {
    for (const [key, value] of Object.entries(reviewYears.reviews)) {
      const subMenu = [
        {
          key: "",
          icon: <BarChartOutlined />,
          label: "Overview",
        },
      ];

      value.users.forEach((user) => {
        subMenu.push({
          key: `/${BASE_PATH}/review/${user.username}?year=${key}`,
          icon: (
            <Avatar
              size={"small"}
              shape={"square"}
              src={`https://cdn.ncfritz.net/amzn/avatar/${user.username}.jpg`}
            />
          ),
          label: `${user.givenName} ${user.surname}`,
        });
      });

      menuItems.push({
        key: `/${BASE_PATH}/reviews/${key}`,
        icon: <CalendarOutlined />,
        label: value.year,
        onTitleClick: updateSubMenus,
        children: subMenu,
      });
    }
  }

  return (
    <Menu
      style={{
        width: 300,
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
          key: `/${BASE_PATH}/users`,
          icon: <UsergroupAddOutlined />,
          label: "Users",
        },
        {
          key: `/${BASE_PATH}/reviewYears`,
          icon: <FolderOutlined />,
          label: "Reviews",
        },
        {
          type: "divider",
        },
        ...menuItems,
      ]}
    />
  );
};
export default ThemisMenu;

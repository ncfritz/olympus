import {
  BarChartOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  EditOutlined,
  HomeOutlined,
  ProjectOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import { Menu } from "antd";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAppSelector } from "../../../redux/hooks";

const BASE_PATH = "minerva";
const SUB_MENUS = {
  "/meetings": "meetings-container",
};

const MATCHERS = {
  "meetings/\\d{4}/\\d{2}/\\d{2}": "meetings-day",
  "meetings/\\d{4}/W\\d{2}": "meetings-week",
  "meetings/\\d{4}/\\d{2}": "meetings-month",
  "meetings/([^/]+)?$": "meetings-day",
};

const MinervaMenu: React.FunctionComponent = () => {
  const router = useRouter();
  const today = DateTime.now();

  const submenuExpanded = useAppSelector(
    (state) => state.layout.submenuExpanded,
  );

  const [sideMenuItem, setSideMenuItem] = useState<string>("/");
  const [sideMenuSubMenuItems, setSideMenuSubMenuItems] = useState<string[]>(
    [],
  );

  const getPathForKey = (key: string) => {
    switch (key) {
      case "meetings-day":
        return `/${BASE_PATH}/meetings/${today.toFormat("yyyy/MM/dd")}`;
      case "meetings-week":
        return `/${BASE_PATH}/meetings/${today.toFormat("yyyy")}/W${today.toFormat("WW")}`;
      case "meetings-month":
        return `/${BASE_PATH}/meetings/${today.toFormat("yyyy/MM")}`;
      default:
        return key;
    }
  };

  const getKeyForPath = (url: string) => {
    for (const [matcher, key] of Object.entries(MATCHERS)) {
      console.log("Checking " + matcher + " against " + url);
      if (new RegExp(matcher).test(url)) {
        console.log("using " + key);
        return key;
      }
    }
    console.log("default");
    return url;
  };

  useEffect(() => {
    const path = router.asPath;
    const items = [];

    for (const [key, value] of Object.entries(SUB_MENUS)) {
      if (path.startsWith(`/${BASE_PATH}${key}`)) {
        items.push(value);
      }
    }

    setSideMenuSubMenuItems(items);
    setSideMenuItem(getKeyForPath(path));
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
        setSideMenuItem(getKeyForPath(key));

        const path = getPathForKey(key);
        router.push(path, path, { shallow: true });
      }}
      items={[
        {
          key: `/${BASE_PATH}`,
          icon: <HomeOutlined />,
          label: "Home",
        },
        {
          key: `/${BASE_PATH}/notes`,
          icon: <EditOutlined />,
          label: "Notes",
        },
        {
          key: `/${BASE_PATH}/projects`,
          icon: <ProjectOutlined />,
          label: "Projects",
        },
        {
          key: `/${BASE_PATH}/tasks`,
          icon: <ScheduleOutlined />,
          label: "Tasks",
        },
        {
          key: "review-container",
          icon: <CarryOutOutlined />,
          label: "Review",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `review-day`,
              icon: <CalendarOutlined />,
              label: "Daily Review",
            },
            {
              key: `review-week`,
              icon: <CalendarOutlined />,
              label: "Weekly Review",
            },
            {
              key: `review-month`,
              icon: <CalendarOutlined />,
              label: "Monthly Review",
            },
          ],
        },
        {
          key: "meetings-container",
          icon: <CalendarOutlined />,
          label: "Meetings",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `meetings-day`,
              icon: <CalendarOutlined />,
              label: "Daily",
            },
            {
              key: `meetings-week`,
              icon: <CalendarOutlined />,
              label: "Weekly",
            },
            {
              key: `meetings-month`,
              icon: <CalendarOutlined />,
              label: "This month",
            },
          ],
        },
        {
          key: `/${BASE_PATH}/meetings/insights`,
          icon: <BarChartOutlined />,
          label: "Meeting Insights",
        },
      ]}
    />
  );
};
export default MinervaMenu;

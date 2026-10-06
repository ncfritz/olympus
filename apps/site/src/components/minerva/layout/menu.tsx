import {
  AimOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  DotChartOutlined,
  EditOutlined,
  HomeOutlined,
  InboxOutlined,
  MailOutlined,
  ProjectOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import { Menu } from "antd";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAppSelector } from "../../../redux/hooks";
import {
  dailyListPath,
  monthOfWeek,
  weeklyListPath,
} from "../../../utils/reviews";

const BASE_PATH = "minerva";
const SUB_MENUS = {
  "/meetings": "meetings-container",
  "/calendars": "meetings-container",
  "/review": "review-container",
  "/mail": "mail-container",
};

const MATCHERS = {
  "^/minerva/mail/reclassification(/.*)?$": "/minerva/mail/reclassification",
  "^/minerva/mail/statistics([/?].*)?$": "/minerva/mail/statistics",
  "^/minerva/mail/clusters([/?].*)?$": "/minerva/mail/clusters",
  "^/minerva/mail/labels([/?].*)?$": "/minerva/mail/labels",
  "^/minerva/mail([/?].*)?$": "/minerva/mail",
  "^/minerva/goals(/.*)?$": "/minerva/goals",
  "^/minerva/calendars([/?].*)?$": "/minerva/calendars",
  "^/minerva/review/daily(/.*)?$": "review-day",
  "^/minerva/review/weekly(/.*)?$": "review-week",
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
      case "review-day":
        return dailyListPath(today);
      case "review-week":
        return weeklyListPath(monthOfWeek(today));
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
      // Collapsed, the submenus are popovers: leave them to open on hover
      // rather than holding the current page's open, as Dionysus does.
      openKeys={submenuExpanded ? sideMenuSubMenuItems : undefined}
      mode={"inline"}
      onSelect={({ key }) => {
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
          key: `/${BASE_PATH}/goals`,
          icon: <AimOutlined />,
          label: "Goals",
        },
        {
          key: "review-container",
          icon: <CarryOutOutlined />,
          label: "Reviews",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `review-day`,
              icon: <CalendarOutlined />,
              label: "Daily Reviews",
            },
            {
              key: `review-week`,
              icon: <CalendarOutlined />,
              label: "Weekly Reviews",
            },
            {
              key: `review-month`,
              icon: <CalendarOutlined />,
              label: "Monthly Reviews",
              disabled: true,
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
            {
              key: `/${BASE_PATH}/calendars`,
              icon: <SettingOutlined />,
              label: "Calendars",
            },
          ],
        },
        {
          key: `/${BASE_PATH}/meetings/insights`,
          icon: <BarChartOutlined />,
          label: "Meeting Insights",
        },
        {
          key: "mail-container",
          icon: <MailOutlined />,
          label: "Mail",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/mail`,
              icon: <InboxOutlined />,
              label: "Inbox",
            },
            {
              key: `/${BASE_PATH}/mail/reclassification`,
              icon: <TagsOutlined />,
              label: "Re-classification",
            },
            {
              key: `/${BASE_PATH}/mail/statistics`,
              icon: <BarChartOutlined />,
              label: "Statistics",
            },
            {
              key: `/${BASE_PATH}/mail/clusters`,
              icon: <DotChartOutlined />,
              label: "Clusters",
            },
            {
              key: `/${BASE_PATH}/mail/labels`,
              icon: <SettingOutlined />,
              label: "Labels",
            },
          ],
        },
      ]}
    />
  );
};
export default MinervaMenu;

import {
  CheckCircleFilled,
  MinusCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Space, Tabs } from "antd";
import { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { DataSummaryResponse } from "../../../pages/api/themis/user/[username]/data/[year]/dataSummary";
import JobHistoryPanel from "./JobHistoryPanel";
import JobInfoPanel from "./JobInfoPanel";
import RatingPanel from "./RatingPanel";

export interface UserDataTabGroupProps {
  username: string;
  year: string;
}

const UserDataTabGroup: React.FunctionComponent<UserDataTabGroupProps> = ({
  username,
  year,
}) => {
  const [dataSummary, setDataSummary] = useState<
    DataSummaryResponse | undefined
  >(undefined);

  useEffect(() => {
    (async () => {
      await loadDataSummary();
    })();
  }, [username, year]);

  const loadDataSummary = async () => {
    try {
      const response = await themisApi.getDataSummary(username, year);
      setDataSummary(response);
    } catch (e) {
      console.log(`Unable to load data summary`);
    }
  };

  const tabLabel = (dataId: keyof DataSummaryResponse, label: string) => {
    let icon = <QuestionCircleOutlined />;

    if (dataSummary) {
      icon = dataSummary[dataId] ? (
        <CheckCircleFilled />
      ) : (
        <MinusCircleOutlined />
      );
    }

    return (
      <Space size={4} direction={"horizontal"} style={{ alignItems: "center" }}>
        {icon} {label}
      </Space>
    );
  };

  return (
    <Tabs
      tabPosition={"left"}
      tabBarGutter={0}
      items={[
        {
          key: `y${year}-jobInfo`,
          label: tabLabel("jobInfo", "Job Info"),
          children: <JobInfoPanel username={username} year={year} />,
        },
        {
          key: `y${year}-performance`,
          label: tabLabel("performance", "Performance"),
          children: <RatingPanel username={username} year={year} />,
        },
        {
          key: `${year}-history`,
          label: tabLabel("jobHistory", "Work History"),
          children: <JobHistoryPanel username={username} year={year} />,
        },
        {
          key: `y${year}-notes`,
          label: tabLabel("notes", "Notes"),
          children: <>Notes</>,
        },
        {
          key: `y${year}-mentorship`,
          label: tabLabel("mentorship", "Mentorship"),
          children: <>Mentorship</>,
        },
        {
          key: `y${year}-code`,
          label: tabLabel("code", "Code"),
          children: <>Code</>,
        },
        {
          key: `y${year}-tt`,
          label: tabLabel("tt", "Trouble Tickets"),
          children: <>Trouble</>,
        },
        {
          key: `y${year}-sim`,
          label: tabLabel("sim", "SIM"),
          children: <>SIM</>,
        },
        {
          key: `y${year}-hiring`,
          label: tabLabel("hiring", "Hiring"),
          children: <>Hiring</>,
        },
      ]}
    />
  );
};
export default UserDataTabGroup;

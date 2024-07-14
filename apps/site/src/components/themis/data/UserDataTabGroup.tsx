import {
  CheckCircleFilled,
  MinusCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Space, Tabs } from "antd";
import { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { UserDataSummary } from "../../../types/themis";
import CodeStatsPanel from "./CodeStatsPanel";
import CRStatsPanel from "./CRStatsPanel";
import FortePanel from "./FortePanel";
import JobHistoryPanel from "./JobHistoryPanel";
import JobInfoPanel from "./JobInfoPanel";
import NotesPanel from "./NotesPanel";
import RatingPanel from "./RatingPanel";

export interface UserDataTabGroupProps {
  username: string;
  year: string;
}

export interface UserDataTabPanelProps {
  username: string;
  year: string;
  afterSave: () => Promise<void>;
}

const UserDataTabGroup: React.FunctionComponent<UserDataTabGroupProps> = ({
  username,
  year,
}) => {
  const [dataSummary, setDataSummary] = useState<UserDataSummary | undefined>(
    undefined,
  );

  useEffect(() => {
    (async () => {
      await loadDataSummary();
    })();
  }, [username, year]);

  const loadDataSummary = async () => {
    try {
      const response = await themisApi.getDataSummaryForYear(username, year);
      setDataSummary(response);
    } catch (e) {
      console.log(`Unable to load data summary`);
    }
  };

  const tabLabel = (dataId: keyof UserDataSummary, label: string) => {
    let icon = <QuestionCircleOutlined />;

    if (dataSummary) {
      icon = dataSummary[dataId] ? (
        <CheckCircleFilled style={{ color: "#006600" }} />
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
          children: (
            <JobInfoPanel
              username={username}
              year={year}
              afterSave={loadDataSummary}
            />
          ),
        },
        {
          key: `y${year}-performance`,
          label: tabLabel("performance", "Performance"),
          children: (
            <RatingPanel
              username={username}
              year={year}
              afterSave={loadDataSummary}
            />
          ),
        },
        {
          key: `${year}-history`,
          label: tabLabel("jobHistory", "Work History"),
          children: (
            <JobHistoryPanel
              username={username}
              year={year}
              afterSave={loadDataSummary}
            />
          ),
        },
        {
          key: `y${year}-forte`,
          label: tabLabel("forteHistory", "Forte History"),
          children: (
            <FortePanel
              username={username}
              year={year}
              afterSave={loadDataSummary}
            />
          ),
        },
        {
          key: `y${year}-notes`,
          label: tabLabel("notes", "Notes"),
          children: (
            <NotesPanel
              username={username}
              year={year}
              afterSave={loadDataSummary}
            />
          ),
        },
        {
          key: `y${year}-mentorship`,
          label: tabLabel("mentorship", "Mentorship"),
          children: <>Mentorship</>,
        },
        {
          key: `y${year}-code`,
          label: tabLabel("code", "Code"),
          children: (
            <CodeStatsPanel
              username={username}
              year={year}
              afterSave={loadDataSummary}
            />
          ),
        },
        {
          key: `y${year}-cr`,
          label: tabLabel("cr", "Code Reviews"),
          children: (
            <CRStatsPanel
              username={username}
              year={year}
              afterSave={loadDataSummary}
            />
          ),
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

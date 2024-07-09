import { Tabs } from "antd";
import RatingForm from "../form/RatingForm";
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
  return (
    <Tabs
      tabPosition={"left"}
      tabBarGutter={0}
      items={[
        {
          key: `y${year}-jobInfo`,
          label: "Job Info",
          children: <JobInfoPanel username={username} year={year} />,
        },
        {
          key: `y${year}-performance`,
          label: "Performance",
          children: <RatingPanel username={username} year={year} />,
        },
        {
          key: `${year}-history`,
          label: "Work History",
          children: <JobHistoryPanel username={username} year={year} />,
        },
        {
          key: `y${year}-notes`,
          label: "Notes",
          children: <>Notes</>,
        },
        {
          key: `y${year}-mentorship`,
          label: "Mentorship",
          children: <>Mentorship</>,
        },
        {
          key: `y${year}-code`,
          label: "Code",
          children: <>Code</>,
        },
        {
          key: `y${year}-tt`,
          label: "Trouble Tickets",
          children: <>Trouble</>,
        },
        {
          key: `y${year}-sim`,
          label: "SIM",
          children: <>SIM</>,
        },
        {
          key: `y${year}-hiring`,
          label: "Hiring",
          children: <>Hiring</>,
        },
      ]}
    />
  );
};
export default UserDataTabGroup;

import { Image, Space, Typography } from "antd";
import { Duration } from "luxon";

interface BadgeProps {
  username: string;
  name: string;
  tenure: number;
}

export const EMPLOYEE_BADGE_BORDER_COLORS: Record<number, string> = {
  5: "#85714d",
  4: "#828282",
  3: "#8800ab",
  2: "#c1160a",
  1: "#f4980a",
  0: "#117ec4",
};

const Badge: React.FunctionComponent<BadgeProps> = ({
  username,
  name,
  tenure,
}) => {
  const firstName = name.split(" ")[0];
  const totalTime = Duration.fromObject({ days: tenure }).as("years");

  return (
    <Space
      direction={"vertical"}
      align={"center"}
      style={{
        width: 160,
        backgroundColor: "#000",
        borderWidth: 5,
        borderStyle: "solid",
        borderColor: EMPLOYEE_BADGE_BORDER_COLORS[Math.floor(totalTime / 5)],
        borderRadius: 10,
      }}
    >
      <Space
        align={"center"}
        style={{
          width: 70,
          height: 15,
          backgroundColor: "#fff",
          borderWidth: 3,
          borderRadius: 10,
          borderColor: EMPLOYEE_BADGE_BORDER_COLORS[Math.floor(totalTime / 5)],
          borderStyle: "solid",
          marginTop: 16,
        }}
      >
        <Typography.Text>&nbsp;</Typography.Text>
      </Space>
      <Space
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        <Typography.Text strong={true} style={{ color: "#fff", fontSize: 16 }}>
          {firstName}
        </Typography.Text>
      </Space>
      <Space
        style={{
          display: "flex",
          justifyContent: "center",
          maskImage:
            "linear-gradient(top, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)",
        }}
      >
        <Image
          src={`https://cdn.ncfritz.net/amzn/avatar/${username}.jpg`}
          fallback={"/peccy.png"}
          preview={false}
          width={140}
        />
      </Space>
      <Space
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 16,
          marginBottom: 24,
        }}
      >
        <Typography.Text italic={true} style={{ color: "#fff", fontSize: 20 }}>
          @{username}
        </Typography.Text>
      </Space>
    </Space>
  );
};

export default Badge;

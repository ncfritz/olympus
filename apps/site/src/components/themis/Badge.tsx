import { Image, Space, Typography } from "antd";
import { Duration } from "luxon";

interface BadgeProps {
  size?: BadgeSize;
  username: string;
  name: string;
  tenure: number;
}

interface BadgeDimensions {
  width: number;
  borderWidth: number;
  borderRadius: number;
  imageWidth: number;
  cutoutWidth: number;
  cutoutHeight: number;
  cutoutBorderRadius: number;
  nameFontSize: number;
  aliasFontSize: number;
  nameMarginTop: number;
  nameMarginBottom: number;
  aliasMarginTop: number;
  aliasMarginBottom: number;
}

export type BadgeSize = "small" | "medium" | "large";

export const EMPLOYEE_BADGE_BORDER_COLORS: Record<number, string> = {
  5: "#85714d",
  4: "#828282",
  3: "#8800ab",
  2: "#c1160a",
  1: "#f4980a",
  0: "#117ec4",
};

const BADGE_DIMENSIONS: Record<BadgeSize, BadgeDimensions> = {
  small: {
    width: 90,
    borderWidth: 3,
    borderRadius: 5,
    imageWidth: 72,
    cutoutWidth: 35,
    cutoutHeight: 7,
    cutoutBorderRadius: 4,
    nameFontSize: 9,
    aliasFontSize: 10,
    nameMarginTop: 8,
    nameMarginBottom: 4,
    aliasMarginTop: 8,
    aliasMarginBottom: 12,
  },
  medium: {
    width: 120,
    borderWidth: 4,
    borderRadius: 8,
    imageWidth: 104,
    cutoutWidth: 50,
    cutoutHeight: 10,
    cutoutBorderRadius: 7,
    nameFontSize: 12,
    aliasFontSize: 13,
    nameMarginTop: 12,
    nameMarginBottom: 6,
    aliasMarginTop: 9,
    aliasMarginBottom: 14,
  },
  large: {
    width: 160,
    borderWidth: 5,
    borderRadius: 10,
    imageWidth: 140,
    cutoutWidth: 70,
    cutoutHeight: 15,
    cutoutBorderRadius: 10,
    nameFontSize: 16,
    aliasFontSize: 20,
    nameMarginTop: 16,
    nameMarginBottom: 8,
    aliasMarginTop: 16,
    aliasMarginBottom: 24,
  },
};

const Badge: React.FunctionComponent<BadgeProps> = ({
  size = "large",
  username,
  name,
  tenure,
}) => {
  const firstName = name.split(" ")[0];
  const totalTime = Duration.fromObject({ days: tenure }).as("years");
  const dimensions = BADGE_DIMENSIONS[size];

  return (
    <Space
      direction={"vertical"}
      align={"center"}
      style={{
        width: dimensions.width,
        backgroundColor: "#000",
        borderWidth: dimensions.borderWidth,
        borderStyle: "solid",
        borderColor: EMPLOYEE_BADGE_BORDER_COLORS[Math.floor(totalTime / 5)],
        borderRadius: dimensions.borderRadius,
      }}
    >
      <Space
        align={"center"}
        style={{
          width: dimensions.cutoutWidth,
          height: dimensions.cutoutHeight,
          backgroundColor: "#fff",
          borderWidth: 3,
          borderRadius: dimensions.cutoutBorderRadius,
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
          marginTop: dimensions.nameMarginTop,
          marginBottom: dimensions.nameMarginBottom,
        }}
      >
        <Typography.Text
          strong={true}
          style={{ color: "#fff", fontSize: dimensions.nameFontSize }}
        >
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
          width={dimensions.imageWidth}
        />
      </Space>
      <Space
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: dimensions.aliasMarginTop,
          marginBottom: dimensions.aliasMarginBottom,
        }}
      >
        <Typography.Text
          italic={true}
          style={{ color: "#fff", fontSize: dimensions.aliasFontSize }}
        >
          @{username}
        </Typography.Text>
      </Space>
    </Space>
  );
};

export default Badge;

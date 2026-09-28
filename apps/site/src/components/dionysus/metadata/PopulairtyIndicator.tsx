import { Progress, Space, Typography } from "antd";
import { getProgressColor } from "./util";

export interface PopularityIndicatorProps {
  popularity?: number;
  voteAverage?: number;
  voteCount?: number;
}

const PopularityIndicator: React.FunctionComponent<
  PopularityIndicatorProps
> = ({
  popularity = 0,
  voteCount = 0,
  voteAverage = 0,
}: PopularityIndicatorProps) => {
  return (
    <Space orientation={"horizontal"} size={16}>
      <Progress
        type={"circle"}
        strokeColor={getProgressColor(popularity * 10 || 0)}
        percent={voteAverage * 10}
        size={64}
        format={(percent) => {
          return (
            <Typography.Text
              style={{
                fontSize: "15px",
                color: "#efefef",
                fontWeight: 500,
              }}
            >
              {percent?.toFixed(0)}%
            </Typography.Text>
          );
        }}
        style={{
          backgroundColor: "#202f3e",
          borderRadius: 48,
          padding: 6,
          zIndex: 99,
          position: "relative",
        }}
      />
      <Space
        orientation={"vertical"}
        style={{
          background: "#202f3e",
          height: 48,
          borderRadius: 24,
          paddingLeft: 36,
          paddingRight: 24,
          position: "relative",
          left: -48,
          gap: 0,
          justifyContent: "center",
          zIndex: 98,
        }}
        styles={{ item: { lineHeight: "12px" } }}
      >
        <Space
          orientation={"horizontal"}
          size={8}
          styles={{ item: { lineHeight: "12px" } }}
        >
          <Typography.Text
            strong={true}
            style={{
              color: "#ffffffdd",
              marginBottom: 0,
              fontSize: "10px",
            }}
          >
            Vote Count:
          </Typography.Text>
          <Typography.Text
            style={{
              color: "#ffffffdd",
              marginBottom: 0,
              fontSize: "10px",
            }}
          >
            {voteCount.toLocaleString()}
          </Typography.Text>
        </Space>
        <Space
          orientation={"horizontal"}
          size={8}
          styles={{ item: { lineHeight: "12px" } }}
        >
          <Typography.Text
            strong={true}
            style={{
              color: "#ffffffdd",
              marginBottom: 0,
              fontSize: "10px",
            }}
          >
            Popularity:
          </Typography.Text>
          <Typography.Text
            style={{
              color: "#ffffffdd",
              marginBottom: 0,
              fontSize: "10px",
            }}
          >
            {popularity.toFixed(2)}
          </Typography.Text>
        </Space>
      </Space>
    </Space>
  );
};
export default PopularityIndicator;

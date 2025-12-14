import { FileImageOutlined } from "@ant-design/icons";
import type { BaseTvSeries } from "@ncfritz/olympus-sdk/dionysus";
import { Card, Space, Typography } from "antd";
import type { ReactNode } from "react";
import { getStatusForTvSeries } from "./util";

export interface TvSeriesPosterCardProps {
  tvSeries: BaseTvSeries;
  showTitle?: boolean;
  showStatus?: boolean;
  actions?: ReactNode[];
  scaleDirection?: "horizontal" | "vertical";
  scaleBaseline?: number;
  hoverable?: boolean;
  className?: string;
}

const TvSeriesPosterCard: React.FunctionComponent<TvSeriesPosterCardProps> = ({
  tvSeries,
  showTitle = false,
  showStatus = false,
  actions = undefined,
  scaleDirection = undefined,
  scaleBaseline = undefined,
  hoverable = false,
  className = undefined,
}: TvSeriesPosterCardProps) => {
  const [statusText, statusColor] = getStatusForTvSeries(tvSeries.status);

  const extra: ReactNode[] = [];

  if (showTitle) {
    extra.push(
      <Typography.Title
        level={5}
        style={{
          fontSize: "9px",
          lineHeight: 1,
          marginBottom: 0,
        }}
      >
        {tvSeries.name}
      </Typography.Title>,
    );
  }

  let scaleFactor = {};

  if (scaleDirection && scaleBaseline) {
    scaleFactor =
      scaleDirection === "vertical"
        ? {
            height: `${scaleBaseline}px`,
          }
        : { width: `${scaleBaseline}px` };
  }

  const bottomDecoration =
    extra && extra.length > 0
      ? {}
      : {
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
        };

  return (
    <Card
      className={className}
      hoverable={hoverable}
      style={{
        borderRadius: 9,
        ...scaleFactor,
      }}
      styles={{
        body: {
          margin: 0,
          padding: 0,
          flexDirection: "column",
          justifyContent: "start",
          display: "flex",
        },
        actions: { margin: 0, padding: 0 },
      }}
      cover={
        tvSeries.posterPath ? (
          <img
            src={`https://image.tmdb.org/t/p/w342/${tvSeries.posterPath}}`}
            alt={"Poster"}
          />
        ) : (
          <Space
            style={{
              aspectRatio: "calc(2 / 3)",
              backgroundColor: "#eeeeee",
            }}
            styles={{
              item: {
                display: "flex",
                alignContent: "center",
                justifyContent: "center",
                height: "100%",
              },
            }}
          >
            <FileImageOutlined style={{ fontSize: "64px", color: "#dddddd" }} />
          </Space>
        )
      }
      actions={actions}
    >
      {showStatus && (
        <Space
          style={{
            width: "100%",
            backgroundColor: statusColor,
            color: "#efefef",
            fontSize: "10px",
            justifyContent: "center",
            ...bottomDecoration,
          }}
        >
          {statusText}
        </Space>
      )}
      {extra.length > 0 && (
        <Space
          size={3}
          direction={"vertical"}
          style={{ padding: 8, width: "100%", textAlign: "center" }}
          styles={{ item: { width: "100%", lineHeight: 1 } }}
        >
          {extra}
        </Space>
      )}
    </Card>
  );
};
export default TvSeriesPosterCard;

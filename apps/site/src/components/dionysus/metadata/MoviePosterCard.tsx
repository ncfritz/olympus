import { FileImageOutlined } from "@ant-design/icons";
import type { SparseMovie } from "@ncfritz/olympus-sdk/dionysus";
import { Card, Space, Typography } from "antd";
import { DateTime } from "luxon";
import type { ReactNode } from "react";
import { getReleaseStatusForMovie } from "./util";

export interface MoviePosterCardProps {
  movie: SparseMovie;
  showTitle?: boolean;
  showReleaseYear?: boolean;
  showReleaseStatus?: boolean;
  actions?: ReactNode[];
  scaleDirection?: "horizontal" | "vertical";
  scaleBaseline?: number;
  hoverable?: boolean;
  className?: string;
}

const MoviePosterCard: React.FunctionComponent<MoviePosterCardProps> = ({
  movie,
  showTitle = false,
  showReleaseYear = false,
  showReleaseStatus = false,
  actions = undefined,
  scaleDirection = undefined,
  scaleBaseline = undefined,
  hoverable = false,
  className = undefined,
}: MoviePosterCardProps) => {
  const [statusText, statusColor] = getReleaseStatusForMovie(movie.status);

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
        {movie.title}
      </Typography.Title>,
    );
  }

  if (showReleaseYear) {
    const year = movie.releaseDate
      ? DateTime.fromISO(movie.releaseDate).year
      : undefined;
    extra.push(
      <Typography.Text
        style={{
          fontSize: "9px",
          color: "#666666",
          lineHeight: 1,
        }}
      >
        {year}
      </Typography.Text>,
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
        movie.posterPath ? (
          <img
            src={`https://image.tmdb.org/t/p/w342/${movie.posterPath}}`}
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
      {showReleaseStatus && (
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
export default MoviePosterCard;

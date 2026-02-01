import { FileImageOutlined, StarFilled } from "@ant-design/icons";
import type {
  SparseEpisode,
  BaseTvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Card, Image, Space, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { type ReactNode } from "react";
import LoadingWrapper from "../../common/LoadingWrapper";
import { getProgressColor } from "./util";

export interface TvEpisodeListProps {
  series: BaseTvSeries;
  episodes: SparseEpisode[];
  currentEpisode?: number;
  loading: boolean;
  error: any;
}

const TvEpisodeList: React.FunctionComponent<TvEpisodeListProps> = ({
  series,
  episodes,
  currentEpisode,
  loading,
  error,
}: TvEpisodeListProps) => {
  const episodeCards: ReactNode[] = [];

  if (episodes) {
    episodes.forEach((episode) => {
      const stillPath = episode.stillPath ? (
        <Image
          src={`https://image.tmdb.org/t/p/w342/${episode.stillPath}}`}
          width={60 * (16 / 9)}
          style={{ borderRadius: 8 }}
          preview={false}
        />
      ) : (
        <Space
          style={{
            width: 60 * (16 / 9),
            height: 60 * (9 / 16),
            backgroundColor: "#eeeeee",
            borderRadius: 8,
          }}
          styles={{
            item: {
              display: "flex",
              alignContent: "center",
              justifyContent: "center",
              height: "100%",
              width: "100%",
            },
          }}
        >
          <FileImageOutlined style={{ fontSize: "64px", color: "#dddddd" }} />
        </Space>
      );

      const airDate = episode.airDate
        ? DateTime.fromISO(episode.airDate)
        : undefined;

      const cardContent = (
        <Card
          variant={"outlined"}
          hoverable={false}
          styles={{
            body: {
              margin: 0,
              padding: 0,
              borderTopRightRadius: "inherit",
              borderBottomRightRadius: "inherit",
              height: 72,
              backgroundColor:
                currentEpisode === episode.episodeNumber
                  ? "#efefef"
                  : "inherit",
            },
          }}
        >
          <Link
            href={`/dionysus/tv/series/${series.id}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
          >
            <Space
              direction={"horizontal"}
              style={{ width: "100%", alignItems: "start", margin: 8 }}
              styles={{ item: { fontSize: "10px" } }}
            >
              {stillPath}
              <Space
                direction={"vertical"}
                style={{ alignItems: "start" }}
                size={0}
              >
                <Typography.Text
                  strong={true}
                  style={{ color: "#666666", fontSize: "13px" }}
                >
                  Episode {episode.episodeNumber}
                </Typography.Text>
                <Typography.Text style={{ fontSize: "12px" }}>
                  {episode.name}
                </Typography.Text>
                <Typography.Text style={{ fontSize: "11px", color: "#999999" }}>
                  {airDate ? airDate.toFormat("yyyy / MM / dd") : undefined}
                </Typography.Text>
              </Space>
            </Space>
          </Link>
        </Card>
      );

      episodeCards.push(
        episode.voteAverage > 0 ? (
          <Badge.Ribbon
            color={getProgressColor(episode.voteAverage * 10)}
            text={
              <Space direction={"horizontal"} size={4}>
                {episode.voteAverage.toFixed(1)} / 10 <StarFilled />
              </Space>
            }
          >
            {cardContent}
          </Badge.Ribbon>
        ) : (
          cardContent
        ),
      );
    });
  }

  return (
    <LoadingWrapper loading={loading} error={error}>
      {episodeCards}
    </LoadingWrapper>
  );
};
export default TvEpisodeList;

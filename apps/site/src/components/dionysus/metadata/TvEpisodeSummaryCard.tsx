import {
  CheckCircleFilled,
  EyeFilled,
  FileImageOutlined,
  PauseCircleFilled,
  StarFilled,
} from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  SparseEpisode,
} from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Card, Image, Progress, Space, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import Description from "../../common/Description";
import MediaBannerWrapper from "../media/MediaBannerWrapper";
import SearchConfigurationButton from "../media/SearchConfigurationButton";
import { getProgressColor } from "./util";

export interface TvEpisodeSummaryCardProps {
  episode: SparseEpisode;
  seriesId: number;
  initialSearchConfiguration?: MediaAssetSearchConfiguration;
}

const TvEpisodeSummaryCard: React.FunctionComponent<
  TvEpisodeSummaryCardProps
> = ({
  episode,
  seriesId,
  initialSearchConfiguration,
}: TvEpisodeSummaryCardProps) => {
  const [searchConfiguration, setSearchConfiguration] = useState(
    initialSearchConfiguration,
  );

  useEffect(() => {
    if (initialSearchConfiguration) {
      setSearchConfiguration(initialSearchConfiguration);
    }
  }, [initialSearchConfiguration]);

  const airDate = episode.airDate
    ? DateTime.fromISO(episode.airDate).toFormat("MM/dd/yyyy")
    : "Unknown";

  const stillImage = episode.stillPath ? (
    <Image
      src={`https://image.tmdb.org/t/p/w300/${episode.stillPath}`}
      preview={false}
      height={150}
      width={150 * (16 / 9)}
      style={{
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
      }}
    />
  ) : (
    <Space
      style={{
        width: 150 * (16 / 9),
        height: 150,
        backgroundColor: "#eeeeee",
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
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
          height: 150,
        },
      }}
    >
      <Space
        className={"episode-fix"}
        orientation={"horizontal"}
        size={8}
        style={{
          height: "100%",
          width: "100%",
          borderTopRightRadius: "inherit",
          borderBottomRightRadius: "inherit",
          alignItems: "start",
        }}
        styles={{
          item: {
            borderTopRightRadius: "inherit",
            borderBottomRightRadius: "inherit",
          },
        }}
      >
        <Space orientation={"vertical"} style={{ padding: 16, width: "100%" }}>
          <Space
            orientation={"horizontal"}
            style={{
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Space
              orientation={"horizontal"}
              size={16}
              style={{ width: "100%", alignItems: "start" }}
            >
              <SearchConfigurationButton
                mediaType={"tv_episode"}
                mediaId={episode.id}
                searchConfiguration={searchConfiguration}
                loading={false}
                className={"light"}
                afterUpdate={async (searchConfiguration) => {
                  setSearchConfiguration(searchConfiguration);
                }}
              />
              <Space
                orientation={"vertical"}
                size={0}
                style={{ width: "100%", paddingRight: 16 }}
              >
                <Link
                  href={`/dionysus/tv/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
                >
                  <Typography.Title
                    level={5}
                    style={{
                      fontSize: "13px",
                      color: "#666666",
                      marginBottom: 0,
                    }}
                  >
                    Episode {String(episode.episodeNumber).padStart(2, "0")}
                  </Typography.Title>
                </Link>
                <Link
                  href={`/dionysus/tv/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
                >
                  <Typography.Title level={5} style={{ marginBottom: 0 }}>
                    {episode.name}
                  </Typography.Title>
                </Link>
                <Typography.Text style={{ fontSize: "12px" }}>
                  {episode.overview}
                </Typography.Text>
              </Space>
            </Space>
            <Space
              orientation={"vertical"}
              size={0}
              styles={{
                item: {
                  display: "flex",
                  justifyContent: "end",
                },
              }}
            >
              <Description
                title={"Air Date:"}
                titleFontSize={"12px"}
                value={airDate}
                direction={"horizontal"}
                style={{ marginTop: 2, whiteSpace: "nowrap" }}
              />
              {episode.voteAverage > 0 && (
                <Space
                  orientation={"horizontal"}
                  size={8}
                  style={{ alignItems: "center" }}
                >
                  <Typography.Text
                    style={{
                      fontSize: "12px",
                      color: "#666666",
                      lineHeight: "12px",
                    }}
                  >
                    {episode.voteAverage.toFixed(1)} / 10 <StarFilled />
                  </Typography.Text>
                  <Progress
                    type={"circle"}
                    size={16}
                    percent={episode.voteAverage * 10}
                    strokeColor={getProgressColor(episode.voteAverage * 10)}
                  />
                </Space>
              )}
            </Space>
          </Space>
        </Space>
        <Link
          href={`/dionysus/tv/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
        >
          {stillImage}
        </Link>
      </Space>
    </Card>
  );

  return (
    <MediaBannerWrapper
      asset={episode.asset !== undefined}
      searchConfiguration={episode.searchConfiguration}
    >
      {cardContent}
    </MediaBannerWrapper>
  );
};
export default TvEpisodeSummaryCard;

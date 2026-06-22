import {
  CaretDownOutlined,
  CaretRightOutlined,
  CheckCircleFilled,
  StarFilled,
} from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  SparseEpisode,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Badge,
  Card,
  Collapse,
  Image,
  Progress,
  Space,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import Description from "../../common/Description";
import MediaBannerWrapper from "../media/MediaBannerWrapper";
import SearchConfigurationButton from "../media/SearchConfigurationButton";
import SearchResultsTable from "../media/SearchResultsTable";
import { getProgressColor } from "./util";

export interface TvEpisodeSearchResultsCardProps {
  episode: SparseEpisode;
  seriesId: number;
  initialSearchConfiguration?: MediaAssetSearchConfiguration;
}

const TvEpisodeSearchResultsCard: React.FunctionComponent<
  TvEpisodeSearchResultsCardProps
> = ({
  episode,
  initialSearchConfiguration,
}: TvEpisodeSearchResultsCardProps) => {
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
        },
      }}
    >
      <Collapse
        defaultActiveKey={
          episode.asset ? undefined : `results-collapse-${episode.id}`
        }
        collapsible={"icon"}
        styles={{
          body: {
            padding: 0,
          },
          header: {
            backgroundColor: "#fafafa",
            alignItems: "center",
          },
          icon: {
            marginRight: 0,
            paddingLeft: 12,
          },
        }}
        expandIcon={({ isActive }) => {
          return isActive ? (
            <CaretDownOutlined style={{ fontSize: "18px" }} />
          ) : (
            <CaretRightOutlined style={{ fontSize: "18px" }} />
          );
        }}
        ghost={true}
        items={[
          {
            key: `results-collapse-${episode.id}`,
            label: (
              <Space
                className={"episode-fix"}
                orientation={"horizontal"}
                size={0}
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
                <Space
                  orientation={"vertical"}
                  style={{ width: "100%" }}
                  styles={{ item: { display: "flex" } }}
                  size={0}
                >
                  <Space
                    orientation={"horizontal"}
                    style={{
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: 16,
                      backgroundColor: "#fafafa",
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
                        <Typography.Title
                          level={5}
                          style={{
                            fontSize: "13px",
                            color: "#666666",
                            marginBottom: 0,
                          }}
                        >
                          Episode{" "}
                          {String(episode.episodeNumber).padStart(2, "0")}
                        </Typography.Title>
                        <Typography.Title level={5} style={{ marginBottom: 0 }}>
                          {episode.name}
                        </Typography.Title>
                      </Space>
                    </Space>
                    <Space
                      orientation={"vertical"}
                      size={0}
                      style={{ paddingRight: 16 }}
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
                            strokeColor={getProgressColor(
                              episode.voteAverage * 10,
                            )}
                          />
                        </Space>
                      )}
                    </Space>
                  </Space>
                </Space>
              </Space>
            ),
            children: (
              <SearchResultsTable
                searchConfiguration={episode.searchConfiguration!}
                containerHeight={885}
              />
            ),
          },
        ]}
      />
    </Card>
  );

  return (
    <MediaBannerWrapper
      asset={episode.asset !== undefined}
      searchConfiguration={searchConfiguration}
    >
      {cardContent}
    </MediaBannerWrapper>
  );
};
export default TvEpisodeSearchResultsCard;

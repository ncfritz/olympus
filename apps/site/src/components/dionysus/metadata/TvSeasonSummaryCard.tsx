import { FileImageOutlined, StarFilled } from "@ant-design/icons";
import type {
  SparseSeason,
  MediaAssetSearchConfiguration,
} from "@ncfritz/olympus-sdk/dionysus";
import { Card, Image, Progress, Space, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useEffect, useState } from "react";
import Description from "../../common/Description";
import SearchConfigurationButton from "../media/SearchConfigurationButton";
import { getProgressColor } from "./util";

export interface TvSeasonSummaryCardProps {
  seriesId: number;
  season: SparseSeason;
  initialSearchConfiguration?: MediaAssetSearchConfiguration;
  afterSearchUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>;
}

const TvSeasonSummaryCard: React.FunctionComponent<
  TvSeasonSummaryCardProps
> = ({
  seriesId,
  season,
  initialSearchConfiguration,
  afterSearchUpdate,
}: TvSeasonSummaryCardProps) => {
  const [searchConfiguration, setSearchConfiguration] = useState(
    initialSearchConfiguration,
  );

  useEffect(() => {
    if (initialSearchConfiguration) {
      setSearchConfiguration(initialSearchConfiguration);
    }
  }, [initialSearchConfiguration]);

  const airDate = season.airDate
    ? DateTime.fromISO(season.airDate).toFormat("MM/dd/yyyy")
    : "Unknown";

  const coverImage = season.posterPath ? (
    <Image
      src={`https://image.tmdb.org/t/p/w300/${season.posterPath}`}
      preview={false}
      height={150}
      width={100}
      style={{
        borderRadius: 8,
        margin: 8,
      }}
    />
  ) : (
    <Space
      style={{
        width: 100,
        height: 150,
        backgroundColor: "#eeeeee",
        borderRadius: 8,
        margin: 8,
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
      styles={{ body: { padding: 0, paddingBottom: 16 } }}
    >
      <Space
        direction={"horizontal"}
        style={{
          width: "100%",
          alignItems: "start",
          justifyContent: "space-between",
        }}
        styles={{ item: { width: "100%" } }}
      >
        <Space
          className={"season-card-fix"}
          direction={"horizontal"}
          size={16}
          style={{ alignItems: "start", display: "flex", width: "100%" }}
        >
          <Link
            href={`/dionysus/tv/series/${seriesId}/season/${season.seasonNumber}`}
          >
            {coverImage}
          </Link>
          <Space
            orientation={"vertical"}
            style={{ padding: 16, width: "100%" }}
          >
            <Space
              className={"season-card-fix"}
              direction={"horizontal"}
              style={{
                alignItems: "start",
                width: "100%",
              }}
              size={16}
            >
              <SearchConfigurationButton
                className={"light"}
                mediaType={"tv_season"}
                mediaId={season.id}
                loading={false}
                zIndex={2}
                searchConfiguration={searchConfiguration}
                afterUpdate={async (searchConfiguration) => {
                  setSearchConfiguration(searchConfiguration);

                  if (afterSearchUpdate) {
                    await afterSearchUpdate(searchConfiguration);
                  }
                }}
              />
              <Space
                orientation={"vertical"}
                size={0}
                style={{ width: "100%" }}
              >
                <Space
                  direction={"horizontal"}
                  size={8}
                  style={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Space orientation={"vertical"} size={0}>
                    <Link
                      href={`/dionysus/tv/series/${seriesId}/season/${season.seasonNumber}`}
                    >
                      <Typography.Title level={5} style={{ marginBottom: 0 }}>
                        {season.name}
                      </Typography.Title>
                    </Link>
                    <Typography.Text
                      style={{ color: "#666666", fontSize: "12px" }}
                    >
                      {season.episodeCount} episodes
                    </Typography.Text>
                  </Space>
                  <Space
                    direction={"vertical"}
                    size={0}
                    style={{ alignItems: "end" }}
                  >
                    <Description
                      title={"Air Date:"}
                      titleFontSize={"12px"}
                      value={airDate}
                      direction={"horizontal"}
                      style={{ marginTop: 2 }}
                    />
                    {season.voteAverage > 0 && (
                      <Space
                        direction={"horizontal"}
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
                          {season.voteAverage.toFixed(1)} / 10 <StarFilled />
                        </Typography.Text>
                        <Progress
                          type={"circle"}
                          size={16}
                          percent={season.voteAverage * 10}
                          strokeColor={getProgressColor(
                            season.voteAverage * 10,
                          )}
                        />
                      </Space>
                    )}
                  </Space>
                </Space>
              </Space>
            </Space>
            <Typography.Text style={{ fontSize: "12px" }}>
              {season.overview}
            </Typography.Text>
          </Space>
        </Space>
      </Space>
    </Card>
  );

  return cardContent;
};
export default TvSeasonSummaryCard;

import { FileImageOutlined, StarFilled } from "@ant-design/icons";
import type { SparseEpisode } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Card, Image, Space, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import Description from "../../common/Description";
import { getProgressColor } from "./util";

export interface TvEpisodeSummaryCardProps {
  episode: SparseEpisode;
  seriesId: number;
}

const TvEpisodeSummaryCard: React.FunctionComponent<
  TvEpisodeSummaryCardProps
> = ({ episode, seriesId }: TvEpisodeSummaryCardProps) => {
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
        direction={"horizontal"}
        size={16}
        style={{
          height: "100%",
          width: "100%",
          borderTopRightRadius: "inherit",
          borderBottomRightRadius: "inherit",
        }}
        styles={{
          item: {
            height: "100%",
            borderTopRightRadius: "inherit",
            borderBottomRightRadius: "inherit",
          },
        }}
      >
        <Space
          direction={"vertical"}
          size={0}
          style={{ padding: 16, width: "100%" }}
        >
          <Space
            direction={"horizontal"}
            style={{
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
            size={48}
          >
            <Link
              href={`/dionysus/tv/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
            >
              <Typography.Title
                level={5}
                style={{ fontSize: "13px", color: "#666666", marginBottom: 0 }}
              >
                Episode {String(episode.episodeNumber).padStart(2, "0")}
              </Typography.Title>
            </Link>
            <Description
              title={"Air Date:"}
              titleFontSize={"12px"}
              value={airDate}
              direction={"horizontal"}
              style={{ marginTop: 2 }}
            />
          </Space>
          <Link
            href={`/dionysus/tv/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
          >
            <Typography.Title level={5} style={{ marginBottom: 16 }}>
              {episode.name}
            </Typography.Title>
          </Link>
          <Typography.Text style={{ fontSize: "12px" }}>
            {episode.overview}
          </Typography.Text>
        </Space>
        <Link
          href={`/dionysus/tv/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
        >
          {stillImage}
        </Link>
      </Space>
    </Card>
  );

  return episode.voteAverage > 0 ? (
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
  );
};
export default TvEpisodeSummaryCard;

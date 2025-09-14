import { FileImageOutlined, StarFilled } from "@ant-design/icons";
import type { SparseSeason } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Card, Image, Space, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import Description from "../../common/Description";
import { getProgressColor } from "./util";

export interface TvSeasonSummaryCardProps {
  seriesId: number;
  season: SparseSeason;
}

const TvSeasonSummaryCard: React.FunctionComponent<
  TvSeasonSummaryCardProps
> = ({ seriesId, season }: TvSeasonSummaryCardProps) => {
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
      hoverable={true}
      styles={{ body: { padding: 0, paddingBottom: 16 } }}
    >
      <Space
        direction={"horizontal"}
        size={16}
        style={{ alignItems: "start", display: "flex" }}
      >
        <Link
          href={`/dionysus/tv/series/${seriesId}/season/${season.seasonNumber}`}
        >
          {coverImage}
        </Link>
        <Space direction={"vertical"} style={{ padding: 16 }} size={0}>
          <Space
            direction={"horizontal"}
            size={8}
            style={{ alignItems: "center" }}
          >
            <Link
              href={`/dionysus/tv/series/${seriesId}/season/${season.seasonNumber}`}
            >
              <Typography.Title level={5} style={{ marginBottom: 0 }}>
                {season.name}
              </Typography.Title>
            </Link>
            <Typography.Text style={{ color: "#666666", fontSize: "12px" }}>
              ({season.episodeCount} episodes)
            </Typography.Text>
          </Space>
          <Description
            title={"Air Date:"}
            titleFontSize={"12px"}
            value={airDate}
            direction={"horizontal"}
            style={{ marginTop: 2, marginBottom: 16 }}
          />
          <Typography.Text style={{ fontSize: "12px" }}>
            {season.overview}
          </Typography.Text>
        </Space>
      </Space>
    </Card>
  );

  return season.voteAverage > 0 ? (
    <Badge.Ribbon
      color={getProgressColor(season.voteAverage * 10)}
      text={
        <Space direction={"horizontal"} size={4}>
          {season.voteAverage.toFixed(1)} / 10 <StarFilled />
        </Space>
      }
    >
      {cardContent}
    </Badge.Ribbon>
  ) : (
    cardContent
  );
};
export default TvSeasonSummaryCard;

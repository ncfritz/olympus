import type { Episode } from "@ncfritz/olympus-sdk/dionysus";
import { Image, Space, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";
import LoadingWrapper from "../../../common/LoadingWrapper";

export interface TvEpisodeHeaderProps {
  episodeId: number;
}

const TvEpisodeHeader: React.FunctionComponent<TvEpisodeHeaderProps> = ({
  episodeId,
}: TvEpisodeHeaderProps) => {
  const [episode, episodeLoading, episodeError] = useFetch<number, Episode>({
    dataType: "TV episode details",
    watch: [episodeId],
    params: episodeId,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await metadataApi.getTvEpisodeById(o)).data.episode,
  });

  let content = (
    <LoadingWrapper
      loading={episodeLoading}
      error={episodeError}
      style={{
        minHeight: 200,
        maxHeight: 200,
        borderBottom: "1px solid #efefef",
        backgroundColor: "#87909a",
      }}
    >
      Loading...
    </LoadingWrapper>
  );

  // The series is the whole of this header -- poster, name, link -- and the SDK
  // now types it optional, so an episode without one has nothing to draw. It
  // keeps the loading placeholder, which beats what it did before: read
  // `backdropPath` off undefined and throw during render.
  if (episode?.series) {
    const headerBackgroundUrl = episode?.series.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${episode.series.backdropPath}`
      : "/section_header.png";

    const titleDecorations: ReactNode[] = [];

    if (episode.airDate) {
      const airDate = DateTime.fromISO(episode.airDate);
      titleDecorations.push(
        <Typography.Text style={{ color: "#efefef" }}>
          {airDate.toFormat("MMMM dd, yyyy")}
        </Typography.Text>,
      );
    }

    if (episode.series.genres && episode.series.genres.length > 0) {
      titleDecorations.push(
        <Space orientation={"horizontal"} size={4}>
          {episode.series.genres.map((genre) => {
            return (
              <Typography.Text
                style={{
                  fontSize: "9px",
                  color: "#efefef",
                  backgroundColor: "#efefef33",
                  border: "1px solid #efefef",
                  borderRadius: 4,
                  padding: 3,
                }}
              >
                {genre.genre.name}
              </Typography.Text>
            );
          })}
        </Space>,
      );
    }

    if (episode.runtime) {
      titleDecorations.push(
        <Typography.Text
          style={{
            fontSize: "11px",
            color: "#efefef",
          }}
        >
          {prettyMilliseconds(episode?.runtime * 60 * 1000)}
        </Typography.Text>,
      );
    }

    content = (
      <Space
        size={0}
        direction={"vertical"}
        className={"movieHeader"}
        style={{
          minHeight: 200,
          maxHeight: 200,
          width: "100%",
          backgroundColor: "#87909a",
          backgroundImage: `linear-gradient(90deg, rgba(135, 144, 154, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
          backgroundPosition: "left 350px top",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          borderBottom: "1px solid #efefef",
          alignItems: "start",
          position: "relative",
        }}
        styles={{
          item: { width: "100%" },
        }}
      >
        <Space
          direction={"horizontal"}
          size={0}
          style={{ display: "flex", alignItems: "center" }}
          styles={{ item: { height: 200 } }}
        >
          <Image
            preview={false}
            style={{
              height: 150,
              width: 100,
              borderRadius: 8,
              margin: 24,
            }}
            src={`https://image.tmdb.org/t/p/w342/${episode.series.posterPath}}`}
            alt={"Poster"}
          />
          <Space
            direction={"vertical"}
            size={0}
            style={{ alignItems: "start", marginTop: 24 }}
          >
            <Link href={`/dionysus/tv/series/${episode.series.id}`}>
              <Typography.Title
                level={1}
                style={{ color: "#ffffffdd", marginBottom: 0 }}
              >
                {episode?.series.name}
              </Typography.Title>
            </Link>
            <Link
              href={`/dionysus/tv/series/${episode.series.id}/season/${episode.seasonNumber}`}
            >
              <Typography.Title
                level={4}
                style={{ color: "#ffffffcc", marginBottom: 3 }}
              >
                Season {episode.seasonNumber}
              </Typography.Title>
            </Link>
            <Typography.Title
              level={5}
              style={{ color: "#ffffffcc", marginBottom: 16 }}
            >
              Episode {episode.episodeNumber}: {episode.name}
            </Typography.Title>
            <Space orientation={"horizontal"}>{titleDecorations}</Space>
          </Space>
        </Space>
      </Space>
    );
  }

  return content;
};
export default TvEpisodeHeader;

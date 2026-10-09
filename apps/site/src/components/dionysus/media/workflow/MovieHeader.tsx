import type { Movie } from "@ncfritz/olympus-sdk/dionysus";
import { Image, Space, Typography } from "antd";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode } from "react";
import metadataApi from "../../../../api/metadataApi";
import { useFetch } from "../../../../hooks/useFetch";
import LoadingWrapper from "../../../common/LoadingWrapper";

export interface MovieHeaderProps {
  movieId: number;
}

const MovieHeader: React.FunctionComponent<MovieHeaderProps> = ({
  movieId,
}: MovieHeaderProps) => {
  const [movie, movieLoading, movieError] = useFetch<number, Movie>({
    dataType: "movie details",
    watch: [movieId],
    params: movieId,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) => (await metadataApi.describeMovie(o)).data.movie,
  });

  let content = (
    <LoadingWrapper
      loading={movieLoading}
      error={movieError}
      style={{
        minHeight: 200,
        maxHeight: 200,
        borderBottom: "1px solid #efefef",
        backgroundColor: "#87909a",
      }}
    >
      Loading
    </LoadingWrapper>
  );

  if (movie) {
    const headerBackgroundUrl = movie?.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${movie.backdropPath}`
      : "/section_header.png";

    const titleDecorations: ReactNode[] = [];

    if (movie.releaseDate) {
      const releaseDate = DateTime.fromISO(movie.releaseDate);
      titleDecorations.push(
        <Typography.Text style={{ color: "#efefef" }}>
          {releaseDate.toFormat("MMMM dd, yyyy")}
        </Typography.Text>,
      );
    }

    if (movie.genres && movie.genres.length > 0) {
      titleDecorations.push(
        <Space orientation={"horizontal"} size={4}>
          {movie.genres.map((genre) => {
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

    if (movie.runtime) {
      titleDecorations.push(
        <Typography.Text
          style={{
            fontSize: "11px",
            color: "#efefef",
          }}
        >
          {prettyMilliseconds(movie?.runtime * 60 * 1000)}
        </Typography.Text>,
      );
    }

    const tagline = movie.tagline ? (
      <Typography.Text
        italic={true}
        style={{
          color: "#d3d3d3",
          maxWidth: 1024,
          display: "flex",
          fontSize: "14px",
        }}
      >
        {movie?.tagline}
      </Typography.Text>
    ) : undefined;

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
          backgroundPosition: "left 650px top",
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
            src={`https://image.tmdb.org/t/p/w342/${movie.posterPath}}`}
            alt={"Poster"}
          />
          <Space
            direction={"vertical"}
            size={8}
            style={{ alignItems: "start", marginTop: 24 }}
          >
            <Typography.Title
              level={1}
              style={{ color: "#ffffffdd", marginBottom: 3 }}
            >
              <Space
                direction={"horizontal"}
                size={8}
                style={{ display: "flex", alignItems: "center" }}
              >
                {movie?.title}
              </Space>
            </Typography.Title>
            <Space orientation={"horizontal"}>{titleDecorations}</Space>
            <Space orientation={"vertical"} style={{ marginTop: 16 }}>
              {tagline}
            </Space>
          </Space>
        </Space>
      </Space>
    );
  }

  return content;
};
export default MovieHeader;

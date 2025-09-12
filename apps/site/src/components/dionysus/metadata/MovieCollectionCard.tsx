import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import type { Collection } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Card, Space, Typography } from "antd";
import { useState } from "react";
import MovieList from "./MovieList";

export interface MovieCollectionCardProps {
  collection?: Collection;
}

const MovieCollectionCard: React.FunctionComponent<
  MovieCollectionCardProps
> = ({ collection }: MovieCollectionCardProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!collection) {
    return undefined;
  }

  const headerBackgroundUrl = collection.backdropPath
    ? `https://image.tmdb.org/t/p/w1280/${collection.backdropPath}`
    : "/section_header.png";

  return (
    <Card
      hoverable={false}
      style={{ width: "100%" }}
      styles={{
        body: {
          margin: 0,
          padding: 16,
          paddingBottom: expanded ? 0 : 16,
          flexDirection: "column",
          justifyContent: "start",
          display: expanded ? "flex" : "none",
        },
        actions: { margin: 0, padding: 0 },
        cover: {
          borderTopRightRadius: "inherit",
          borderTopLeftRadius: "inherit",
          borderBottomLeftRadius: expanded ? 0 : "inherit",
          borderBottomRightRadius: expanded ? 0 : "inherit",
          minHeight: 250,
          maxHeight: 250,
          backgroundColor: "#021629",
          backgroundImage: `linear-gradient(90deg, rgba(0, 21, 41, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
          backgroundPosition: "left bottom 60%",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          position: "relative",
          display: "flex",
          alignItems: "stretch",
        },
      }}
      cover={
        <Space
          direction={"vertical"}
          style={{
            display: "flex",
            padding: 32,
            justifyContent: "space-between",
          }}
        >
          <Space direction={"vertical"}>
            <Typography.Text style={{ color: "#efefefcc", fontSize: "24px" }}>
              Part of the {collection.name}
            </Typography.Text>
            <Space style={{ maxWidth: 950 }}>
              <Typography.Text
                style={{ color: "#efefefef", fontSize: "12px", maxWidth: 750 }}
              >
                {collection.overview}
              </Typography.Text>
            </Space>
          </Space>
          <Space
            direction={"horizontal"}
            size={16}
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Button
              size={"large"}
              type={"text"}
              style={{ color: "#efefef" }}
              icon={expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
              onClick={() => setExpanded(!expanded)}
            >
              Show Movies in Collection
            </Button>
            <Button
              size={"large"}
              ghost={true}
              variant={"filled"}
              style={{
                borderRadius: 32,
              }}
              href={`/dionysus/collections/${collection.id}`}
            >
              View Collection
            </Button>
          </Space>
        </Space>
      }
    >
      <MovieList
        columns={8}
        movies={collection.parts.map((part) => part.movie)}
        loading={false}
      />
    </Card>
  );
};
export default MovieCollectionCard;

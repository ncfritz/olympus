import {
  CheckCircleFilled,
  EyeFilled,
  InfoCircleFilled,
  PauseCircleFilled,
  SafetyCertificateTwoTone,
} from "@ant-design/icons";
import type { SparseMovie } from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Button, Card, Popover, Space, Typography } from "antd";
import { DateTime } from "luxon";
import prettyMilliseconds from "pretty-ms";
import React, {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Events, subscribe, unsubscribe } from "../../../utils/events";
import SearchConfigurationButton from "../media/SearchConfigurationButton";
import PopularityIndicator from "./PopulairtyIndicator";
import { getPoster, getReleaseStatusForMovie } from "./util";

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
  bordered?: boolean;
  enablePopover?: boolean;
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
  bordered = true,
  enablePopover = false,
}: MoviePosterCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [cardX, setCardX] = useState(0);
  const [cardY, setCardY] = useState(0);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [coverHover, setCoverHover] = useState(false);
  const [searchConfiguration, setSearchConfiguration] = useState(
    movie.searchConfiguration,
  );

  useEffect(() => {
    setSearchConfiguration(movie.searchConfiguration);
  }, [movie]);

  useEffect(() => {
    subscribe(
      Events.DIONYSUS_MEDIA_SEARCH_CONFIGURATION_UPDATED,
      onSearchConfigurationUpdated,
    );

    return () => {
      unsubscribe(
        Events.DIONYSUS_MEDIA_SEARCH_CONFIGURATION_UPDATED,
        onSearchConfigurationUpdated,
      );
    };
  }, []);

  const onSearchConfigurationUpdated = (e: CustomEvent) => {
    if (e.detail.type === "movie" && e.detail.mediaId === movie.id) {
      console.log("Updated search configuration", e.detail);
      setSearchConfiguration(e.detail);
    }
  };

  useLayoutEffect(() => {
    if (cardRef.current) {
      setCardHeight(cardRef.current.getBoundingClientRect().height);
      setCardWidth(cardRef.current.getBoundingClientRect().width);
      setCardX(cardRef.current.getBoundingClientRect().x);
      setCardY(cardRef.current.getBoundingClientRect().y);
    }
  }, [cardRef.current?.getBoundingClientRect()]);

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
      : "Year ???";
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

  let scaleFactor: CSSProperties = {};

  if (scaleDirection && scaleBaseline) {
    scaleFactor =
      scaleDirection === "vertical"
        ? {
            height: scaleBaseline,
          }
        : { width: scaleBaseline };
  }

  const bottomDecoration =
    extra && extra.length > 0
      ? {}
      : {
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
        };

  const cardContent = (
    <Card
      ref={cardRef}
      className={["dionysus-card", className].join(" ")}
      hoverable={hoverable}
      variant={bordered ? "outlined" : "borderless"}
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
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => {
            setCoverHover(true);
          }}
          onMouseLeave={() => {
            setCoverHover(false);
          }}
        >
          {enablePopover && coverHover && (
            <Button
              style={{ float: "left", position: "absolute", color: "#ffffff" }}
              type="text"
              icon={<InfoCircleFilled />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPopoverOpen(true);
              }}
            />
          )}
          {getPoster(movie.posterPath, scaleDirection, scaleBaseline)}
        </div>
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
          orientation={"vertical"}
          style={{ padding: 8, width: "100%", textAlign: "center" }}
          styles={{ item: { width: "100%", lineHeight: 1 } }}
        >
          {extra}
        </Space>
      )}
    </Card>
  );

  let content;
  let popoverContent: ReactNode | undefined = undefined;

  if (enablePopover) {
    const headerBackgroundUrl = movie?.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${movie.backdropPath}`
      : "/section_header.png";

    const titleDecorations: ReactNode[] = [];

    if (movie.releaseDate) {
      const releaseDate = DateTime.fromISO(movie.releaseDate);
      titleDecorations.push(
        <Typography.Text style={{ color: "#efefef", fontSize: "11px" }}>
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

    popoverContent = (
      <Space
        size={0}
        orientation={"vertical"}
        style={{ width: "100%", borderRadius: "inherit" }}
        styles={{ item: { borderRadius: "inherit" } }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <Space
          size={0}
          orientation={"vertical"}
          className={"movieHeader"}
          style={{
            borderTopLeftRadius: "inherit",
            borderTopRightRadius: "inherit",
            minHeight: 190,
            maxHeight: 190,
            width: "100%",
            backgroundColor: "#021629",
            backgroundImage: `linear-gradient(90deg, rgba(0, 21, 41, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
            backgroundPosition: "left 200px top",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            borderBottom: "1px solid #efefef",
            alignItems: "start",
            position: "relative",
            padding: 12,
          }}
          styles={{
            item: { width: "100%", borderRadius: "inherit" },
          }}
        >
          <Space
            orientation={"horizontal"}
            style={{ alignItems: "start" }}
            size={16}
          >
            <div>{getPoster(movie.posterPath, "vertical", 166, 4)}</div>
            <Typography.Title
              level={4}
              style={{ color: "#ffffffdd", marginBottom: 3 }}
            >
              <Space
                orientation={"vertical"}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  height: 166,
                }}
                styles={{
                  item: {
                    lineHeight: "12px",
                  },
                }}
              >
                <Space orientation={"vertical"} size={2}>
                  <Space
                    orientation={"horizontal"}
                    size={8}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      paddingTop: 4,
                      marginBottom: 8,
                    }}
                  >
                    {movie.asset && (
                      <SafetyCertificateTwoTone
                        twoToneColor={"#488633"}
                        style={{ fontSize: "20px" }}
                      />
                    )}
                    {movie?.title}
                  </Space>
                  <Typography.Text
                    italic={true}
                    style={{
                      marginLeft: movie.asset ? 4 : 0,
                      color: "#d3d3d3",
                      display: "flex",
                      fontSize: "12px",
                    }}
                  >
                    {movie?.tagline}
                  </Typography.Text>
                  <Space
                    orientation={"horizontal"}
                    style={{
                      lineHeight: "12px",
                      marginLeft: movie.asset ? 4 : 0,
                    }}
                  >
                    {titleDecorations}
                  </Space>
                </Space>
                <Space
                  orientation={"horizontal"}
                  size={8}
                  style={{ alignItems: "center" }}
                >
                  <PopularityIndicator
                    popularity={movie.popularity}
                    voteCount={movie.voteCount}
                    voteAverage={movie.voteAverage}
                  />
                  <Space
                    size={16}
                    orientation={"horizontal"}
                    style={{ left: -48, position: "relative" }}
                  >
                    <SearchConfigurationButton
                      mediaType={"movie"}
                      mediaId={movie.id}
                      searchConfiguration={searchConfiguration}
                      loading={false}
                    />
                  </Space>
                </Space>
              </Space>
            </Typography.Title>
          </Space>
        </Space>
        <Space style={{ width: "100%", padding: 12, paddingTop: 0 }}>
          <Space orientation={"vertical"} size={0}>
            <Typography.Title
              style={{ color: "#444444", marginBottom: 0 }}
              level={5}
            >
              Overview
            </Typography.Title>
            <Typography.Text
              style={{ color: "#666666", fontSize: "12px", display: "flex" }}
            >
              {movie?.overview}
            </Typography.Text>
          </Space>
        </Space>
      </Space>
    );

    const cardPosition: CSSProperties = {
      top: 0,
    };

    if (cardX + 790 > window.innerWidth) {
      cardPosition.left =
        movie.asset || searchConfiguration
          ? -790 + cardWidth
          : -780 + cardWidth;
    } else {
      cardPosition.left = movie.asset || searchConfiguration ? 0 : 9;
    }

    content = (
      <Popover
        open={popoverOpen}
        content={popoverContent}
        getPopupContainer={(triggerNode) => triggerNode}
        mouseLeaveDelay={0.5}
        onOpenChange={(open) => {
          if (!open) {
            setPopoverOpen(false);
          }
        }}
        motion={{
          motionName: "",
        }}
        trigger="hover"
        arrow={false}
        styles={{
          root: {
            borderRadius: "inherit",
            ...cardPosition,
          },
          container: {
            borderRadius: "inherit",
            padding: 0,
            height: `${Math.ceil(cardHeight)}px`,
          },
          content: {
            borderRadius: "inherit",
            width: 790,
          },
        }}
      >
        <div
          style={{
            borderRadius: 8,
          }}
          onClick={(e) => {
            if (popoverOpen) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {cardContent}
        </div>
      </Popover>
    );
  } else {
    content = cardContent;
  }

  if (movie.asset) {
    return (
      <Badge.Ribbon
        color={"#478133"}
        style={{ fontSize: "12px" }}
        text={<CheckCircleFilled />}
      >
        {content}
      </Badge.Ribbon>
    );
  } else if (searchConfiguration) {
    return (
      <Badge.Ribbon
        color={searchConfiguration.enabled ? "#2657a8" : "#c5981c"}
        style={{ fontSize: "12px" }}
        text={
          searchConfiguration.enabled ? <EyeFilled /> : <PauseCircleFilled />
        }
      >
        {content}
      </Badge.Ribbon>
    );
  } else {
    return content;
  }
};
export default MoviePosterCard;

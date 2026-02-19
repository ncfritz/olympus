import {
  BookOutlined,
  CalendarOutlined,
  CloudDownloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  HeartOutlined,
  HomeOutlined,
  InfoCircleFilled,
  QrcodeOutlined,
} from "@ant-design/icons";
import type {
  Episode,
  MediaAssetSearchConfiguration,
  Season,
  TvEpisodeCastMember,
  TvEpisodeCrewMember,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Layout,
  Space,
  Spin,
  Typography,
  Splitter,
  Tabs,
  Button,
  Progress,
  Image,
  QRCode,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import mediaApi from "../../../../../../../../api/mediaApi";
import metadataApi from "../../../../../../../../api/metadataApi";
import Description from "../../../../../../../../components/common/Description";
import LoadingWrapper from "../../../../../../../../components/common/LoadingWrapper";
import SearchConfigurationPanel from "../../../../../../../../components/dionysus/media/SearchConfigurationPanel";
import ExternalIdsList from "../../../../../../../../components/dionysus/metadata/ExternalIdsList";
import MetadataFetchJobPanel from "../../../../../../../../components/dionysus/metadata/MetadataFetchJobPanel";
import MovieImagesPanel from "../../../../../../../../components/dionysus/metadata/MovieImagesPanel";
import MovieVideoPanel from "../../../../../../../../components/dionysus/metadata/MovieVideoPanel";
import SearchConfigurationButton from "../../../../../../../../components/dionysus/media/SearchConfigurationButton";
import TvEpisodeCastList from "../../../../../../../../components/dionysus/metadata/TvEpisodeCastList";
import TvEpisodeCrewList from "../../../../../../../../components/dionysus/metadata/TvEpisodeCrewList";
import TvEpisodeList from "../../../../../../../../components/dionysus/metadata/TvEpisodeList";
import TvSeasonSummaryCard from "../../../../../../../../components/dionysus/metadata/TvSeasonSummaryCard";
import { getProgressColor } from "../../../../../../../../components/dionysus/metadata/util";
import OlympusBreadcrumbs from "../../../../../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../../../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../../../../../../icons";

interface SeasonId {
  seriesId: number;
  seasonNumber: number;
}

interface EpisodeId {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
}

const topOffset = 301;

const TvEpisodeDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;
  const { seasonNumber } = router.query;
  const { episodeNumber } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");

  const [episode, episodeLoading, episodeError, fetchEpisode] = useFetch<
    EpisodeId,
    Episode
  >({
    dataType: "TV episode details",
    watch: [id, seasonNumber, episodeNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
      episodeNumber: episodeNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (
        await metadataApi.describeTvEpisode(
          o.seriesId,
          o.seasonNumber,
          o.episodeNumber,
        )
      ).data.episode,
  });

  const [tvSeason, tvSeasonLoading, tvSeasonError, fetchTvSeason] = useFetch<
    SeasonId,
    Season
  >({
    dataType: "TV season episodes",
    watch: [id, seasonNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (await metadataApi.describeTvSeason(o.seriesId, o.seasonNumber)).data
        .season,
  });

  const [crew, crewLoading, crewError] = useFetch<
    EpisodeId,
    TvEpisodeCrewMember[]
  >({
    dataType: "TV episode crew",
    watch: [id, seasonNumber, episodeNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
      episodeNumber: episodeNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (
        await metadataApi.listTvEpisodeCrew(
          o.seriesId,
          o.seasonNumber,
          o.episodeNumber,
        )
      ).data.crew,
  });

  const [cast, castLoading, castError] = useFetch<
    EpisodeId,
    TvEpisodeCastMember[]
  >({
    dataType: "TV episode cast",
    watch: [id, seasonNumber, episodeNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
      episodeNumber: episodeNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (
        await metadataApi.listTvEpisodeCast(
          o.seriesId,
          o.seasonNumber,
          o.episodeNumber,
        )
      ).data.cast,
  });

  const [guestStars, guestStarsLoading, guestStarsError] = useFetch<
    EpisodeId,
    TvEpisodeCastMember[]
  >({
    dataType: "TV episode guest stars",
    watch: [id, seasonNumber, episodeNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
      episodeNumber: episodeNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (
        await metadataApi.listTvEpisodeGuestStars(
          o.seriesId,
          o.seasonNumber,
          o.episodeNumber,
        )
      ).data.guestStars,
  });

  const [
    searchConfiguration,
    searchConfigurationLoading,
    searchConfigurationError,
    fetchSearchConfiguration,
    setSearchConfiguration,
  ] = useFetch<number, MediaAssetSearchConfiguration>({
    dataType: "search configuration",
    watch: [episode],
    params: episode?.id,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await mediaApi.describeMediaAssetSearchConfiguration("tv_episode", o))
        .data.searchConfiguration,
  });

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );

  if (episode) {
    const headerBackgroundUrl = episode?.series.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${episode.series.backdropPath}`
      : "/section_header.png";
    const airDate = episode.airDate
      ? DateTime.fromISO(episode.airDate)
      : undefined;

    const stillPath = episode.stillPath ? (
      <Image
        src={`https://image.tmdb.org/t/p/w342/${episode.stillPath}}`}
        width={275}
        style={{ borderRadius: 8 }}
      />
    ) : (
      <Space
        style={{
          width: 150 * (16 / 9),
          height: 150,
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

    const mainTabs = [
      {
        key: "t-main-general",
        label: "Overview",
        children: (
          <Space
            direction={"vertical"}
            style={{ width: "100%", padding: 16 }}
            styles={{
              item: {
                width: "100%",
              },
            }}
          >
            <Space
              direction={"horizontal"}
              style={{
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
              size={16}
            >
              <Typography.Title level={4} style={{ marginBottom: 0 }}>
                Top Billed Cast
              </Typography.Title>
              <Button
                size={"small"}
                ghost={true}
                type={"text"}
                onClick={() => {
                  setActiveTab("t-main-cast");
                }}
              >
                Full Cast List
              </Button>
            </Space>
            <LoadingWrapper
              loading={castLoading}
              error={castError}
              showError={true}
            >
              <TvEpisodeCastList
                cast={cast?.length > 0 ? cast.slice(0, 12) : []}
              />
            </LoadingWrapper>
            <Space
              direction={"horizontal"}
              style={{
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
              size={16}
            >
              <Typography.Title level={4} style={{ marginBottom: 0 }}>
                Guest Stars
              </Typography.Title>
              <Button
                size={"small"}
                ghost={true}
                type={"text"}
                onClick={() => {
                  setActiveTab("t-main-guest-stars");
                }}
              >
                Full Guest Star List
              </Button>
            </Space>
            <LoadingWrapper
              loading={guestStarsLoading}
              error={guestStarsError}
              showError={true}
            >
              <TvEpisodeCastList
                cast={guestStars?.length > 0 ? guestStars.slice(0, 12) : []}
              />
            </LoadingWrapper>
            <TvSeasonSummaryCard
              seriesId={episode.series.id}
              season={episode.season}
              initialSearchConfiguration={episode.season.searchConfiguration}
              afterSearchUpdate={async () => {
                //await fetchTvSeason(true);
                await fetchEpisode(true);
              }}
            />
          </Space>
        ),
      },
      {
        key: "t-main-cast",
        label: "Cast",
        children: (
          <Space direction={"vertical"} style={{ width: "100%", padding: 16 }}>
            <LoadingWrapper loading={castLoading} error={castError}>
              <TvEpisodeCastList cast={cast} />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-guest-stars",
        label: "Guest Stars",
        children: (
          <Space direction={"vertical"} style={{ width: "100%", padding: 16 }}>
            <LoadingWrapper loading={castLoading} error={castError}>
              <TvEpisodeCastList cast={guestStars} />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-crew",
        label: "Crew",
        children: (
          <Space direction={"vertical"} style={{ width: "100%", padding: 16 }}>
            <LoadingWrapper loading={crewLoading} error={crewError}>
              <TvEpisodeCrewList crew={crew} />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-images",
        label: "Images",
        children: (
          <MovieImagesPanel images={episode.images} imageTypes={["still"]} />
        ),
      },
      {
        key: "t-main-videos",
        label: "Videos",
        children: <MovieVideoPanel videos={episode.videos} />,
      },
    ];

    const sideTabs = [
      {
        key: "t-info-general",
        label: <InfoCircleFilled />,
        children: (
          <Space direction={"vertical"} style={{ padding: 12, width: "100%" }}>
            <Description
              title={"Other Episodes"}
              style={{ width: "100%", paddingRight: 8 }}
              value={
                <TvEpisodeList
                  series={tvSeason?.series}
                  episodes={tvSeason?.episodes}
                  currentEpisode={episode.episodeNumber}
                  loading={tvSeasonLoading}
                  error={tvSeasonError}
                />
              }
            />
          </Space>
        ),
      },
      {
        key: "m-info-qr",
        label: <QrcodeOutlined />,
        children: (
          <Space
            size={0}
            style={{
              width: "100%",
              padding: 16,
              alignItems: "center",
            }}
            direction={"vertical"}
          >
            <QRCode
              style={{ marginTop: 64 }}
              size={350}
              bordered={false}
              errorLevel={"H"}
              value={`https://dionysus.dev.ncfritz.net/dionysus/tv/series/${episode.series.id}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
            />
          </Space>
        ),
      },
      {
        key: "t-info-releases",
        label: <CalendarOutlined />,
        children: (
          <Space
            size={0}
            style={{ width: "100%", padding: 16 }}
            direction={"vertical"}
          ></Space>
        ),
      },
      {
        key: "m-info-fetchJob",
        label: <CloudDownloadOutlined />,
        children: (
          <Space
            size={0}
            style={{ width: "100%", padding: 16 }}
            direction={"vertical"}
          >
            <MetadataFetchJobPanel
              id={`${id}-${episode.season.seasonNumber}-${episode.episodeNumber}`}
              type={"tv_episodes"}
            />
          </Space>
        ),
      },
    ];

    if (searchConfiguration) {
      mainTabs.push({
        key: "t-main-searchResults",
        label: "Search Results",
        children: (
          <Space direction={"vertical"} style={{ width: "100%", padding: 16 }}>
            fff
          </Space>
        ),
      });

      sideTabs.splice(-1, 0, {
        key: "t-info-searchConfig",
        label: <EyeOutlined />,
        children: (
          <Space direction={"vertical"} style={{ width: "100%", padding: 16 }}>
            <Typography.Title level={5}>Search Executions:</Typography.Title>
            <SearchConfigurationPanel
              searchConfiguration={searchConfiguration}
            />
          </Space>
        ),
      });
    }
    const overview = episode.overview ? (
      <Space direction={"vertical"} size={0} style={{ padding: 16 }}>
        <Typography.Title
          style={{ color: "#222222", marginBottom: 0 }}
          level={4}
        >
          Overview
        </Typography.Title>
        <Typography.Text
          style={{ color: "#333333", maxWidth: 1024, display: "flex" }}
        >
          {episode?.overview}
        </Typography.Text>
      </Space>
    ) : undefined;

    content = (
      <Space
        direction={"vertical"}
        size={0}
        style={{ width: "100%", height: "100%" }}
        styles={{ item: { width: "100%" } }}
      >
        <Space
          size={0}
          direction={"vertical"}
          className={"movieHeader"}
          style={{
            minHeight: 200,
            maxHeight: 200,
            width: "100%",
            backgroundColor: "#021629",
            backgroundImage: `linear-gradient(90deg, rgba(0, 21, 41, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
            backgroundPosition: "left 150px top",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            borderBottom: "1px solid #efefef",
            alignItems: "start",
            position: "relative",
          }}
          styles={{
            item: { width: "100%", height: 200 },
          }}
        >
          <Space
            direction={"horizontal"}
            size={0}
            style={{ display: "flex", alignItems: "center" }}
            styles={{ item: { height: 200 } }}
          >
            <Link href={`/dionysus/tv/series/${episode.series.id}`}>
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
            </Link>
            <Space
              direction={"vertical"}
              size={8}
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
              <Space direction={"horizontal"}>
                <Link
                  href={`/dionysus/tv/series/${episode.series.id}/season/${episode.seasonNumber}`}
                >
                  <Typography.Title
                    level={4}
                    style={{ color: "#ffffffcc", marginBottom: 3 }}
                  >
                    Season {episode.season.seasonNumber}
                  </Typography.Title>
                </Link>
                <Typography.Title
                  level={4}
                  style={{ color: "#ffffffcc", marginBottom: 3 }}
                >
                  -
                </Typography.Title>
                <Typography.Title
                  level={5}
                  style={{ color: "#ffffffcc", marginBottom: 3 }}
                >
                  Episode {episode.episodeNumber}: {episode.name}
                </Typography.Title>
              </Space>
              <Space
                direction={"horizontal"}
                size={16}
                style={{
                  alignItems: "center",
                  display: "flex",
                }}
              >
                <Progress
                  type={"circle"}
                  strokeColor={getProgressColor(episode.voteAverage * 10)}
                  percent={episode.voteAverage * 10}
                  size={48}
                  format={(percent) => {
                    return (
                      <Typography.Text
                        style={{
                          fontSize: "13px",
                          color: "#efefef",
                          fontWeight: 500,
                        }}
                      >
                        {percent?.toFixed(0)}%
                      </Typography.Text>
                    );
                  }}
                  style={{
                    backgroundColor: "#99999933",
                    borderRadius: 48,
                    padding: 6,
                  }}
                />
                <Button
                  className={"dionysus-action-button"}
                  shape={"circle"}
                  size={"large"}
                  icon={<HeartOutlined />}
                />
                <Button
                  className={"dionysus-action-button"}
                  shape={"circle"}
                  size={"large"}
                  icon={<BookOutlined />}
                />
                <SearchConfigurationButton
                  mediaType={"tv_episode"}
                  mediaId={episode.id}
                  seriesId={episode.series.id}
                  seasonNumber={episode.seasonNumber}
                  episodeNumber={episode.episodeNumber}
                  searchConfiguration={searchConfiguration}
                  loading={searchConfigurationLoading || tvSeasonLoading}
                  afterUpdate={async (searchConfiguration) => {
                    setSearchConfiguration(searchConfiguration);
                  }}
                />
              </Space>
            </Space>
          </Space>
        </Space>
        <Space
          direction={"horizontal"}
          style={{ width: "100%", position: "relative" }}
          styles={{
            item: {
              width: "100%",
              minHeight: `calc(100vh - ${topOffset}px`,
            },
          }}
        >
          <Splitter
            style={{
              width: "100%",
              minHeight: `calc(100vh - ${topOffset}px`,
            }}
          >
            <Splitter.Panel>
              <Space
                direction={"horizontal"}
                className={"person-fix"}
                size={0}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "start",
                }}
              >
                <Space direction={"vertical"} style={{ padding: 16 }}>
                  {stillPath}
                  <Description
                    title={"Air Date"}
                    value={
                      airDate ? airDate.toFormat("yyyy / MM / dd") : undefined
                    }
                  />
                  <ExternalIdsList ids={episode.externalIds} />
                </Space>
                <Space
                  direction={"vertical"}
                  style={{
                    width: "100%",
                    height: `calc(100vh - ${topOffset - 16}px`,
                    alignItems: "top",
                    overflow: "scroll",
                  }}
                >
                  {overview}
                  <Tabs
                    className={"fill"}
                    activeKey={activeTab}
                    onChange={(activeKey: string) => {
                      setActiveTab(activeKey);
                    }}
                    tabPosition={"top"}
                    size={"small"}
                    items={mainTabs}
                  />
                </Space>
              </Space>
            </Splitter.Panel>
            <Splitter.Panel resizable={false} defaultSize={550}>
              <Tabs
                tabPosition={"right"}
                className={"compact"}
                items={sideTabs}
              />
            </Splitter.Panel>
          </Splitter>
        </Space>
      </Space>
    );
  }

  return (
    <>
      <OlympusBreadcrumbs
        className={"dark"}
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus"}>
                <Space size={4}>
                  <MetadataOutlinedIcon />
                  <span>Dionysus</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/dionysus/movies"}>
                <Space size={4}>
                  <MetadataOutlinedIcon />
                  <span>Movies</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <MetadataOutlinedIcon />
                <span>{episode?.name ? episode.name : "Loading..."}</span>
              </Space>
            ),
          },
        ]}
      />
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 64 + 28,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 48px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 380px)" }}>{content}</Content>
      </Layout>
    </>
  );
};

export default TvEpisodeDetailPage;

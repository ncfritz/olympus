import {
  BookOutlined,
  CalendarOutlined,
  CloudDownloadOutlined,
  EyeOutlined,
  HomeOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  Season,
  TvSeriesCastMember,
  TvSeriesCrewMember,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Space,
  Spin,
  Typography,
  Tabs,
  Button,
  Progress,
  Image,
  QRCode,
  Layout,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import mediaApi from "../../../../../../api/mediaApi";
import metadataApi from "../../../../../../api/metadataApi";
import Description from "../../../../../../components/common/Description";
import LoadingWrapper from "../../../../../../components/common/LoadingWrapper";
import FavoriteButton from "../../../../../../components/dionysus/media/FavoriteButton";
import SearchConfigurationPanel from "../../../../../../components/dionysus/media/SearchConfigurationPanel";
import ExternalIdsList from "../../../../../../components/dionysus/metadata/ExternalIdsList";
import MetadataFetchJobPanel from "../../../../../../components/dionysus/metadata/MetadataFetchJobPanel";
import MovieImagesPanel from "../../../../../../components/dionysus/metadata/MovieImagesPanel";
import MovieVideoPanel from "../../../../../../components/dionysus/metadata/MovieVideoPanel";
import SearchConfigurationButton from "../../../../../../components/dionysus/media/SearchConfigurationButton";
import SeasonEpisodeCalendar from "../../../../../../components/dionysus/metadata/SeasonEpisodeCalendar";
import TvEpisodeSearchResultsCard from "../../../../../../components/dionysus/metadata/TvEpisodeSearchResultsCard";
import TvEpisodeSummaryCard from "../../../../../../components/dionysus/metadata/TvEpisodeSummaryCard";
import TvSeriesCastList from "../../../../../../components/dionysus/metadata/TvSeriesCastList";
import TvSeriesCrewList from "../../../../../../components/dionysus/metadata/TvSeriesCrewList";
import { getProgressColor } from "../../../../../../components/dionysus/metadata/util";
import CollapsibleTabPanel from "../../../../../../components/layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../../../../icons";
import { OLYMPUS_HOST } from "../../../../../../utils/constants";

interface SeasonId {
  seriesId: number;
  seasonNumber: number;
}

const topOffset = 301;

const TvSeriesDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;
  const { seasonNumber } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");

  const [tvSeason, tvSeasonLoading, tvSeasonError, fetchTvSeason] = useFetch<
    SeasonId,
    Season
  >({
    dataType: "TV season details",
    watch: [id, seasonNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (await metadataApi.describeTvSeason(o.seriesId, o.seasonNumber)).data
        .season,
  });

  const [cast, castLoading, castError] = useFetch<
    SeasonId,
    TvSeriesCastMember[]
  >({
    dataType: "TV series cast",
    watch: [id, seasonNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (await metadataApi.listTvSeasonCast(o.seriesId, o.seasonNumber)).data
        .cast,
  });

  const [crew, crewLoading, crewError] = useFetch<
    SeasonId,
    TvSeriesCrewMember[]
  >({
    dataType: "TV series crew",
    watch: [id, seasonNumber],
    params: {
      seriesId: id as unknown as number,
      seasonNumber: seasonNumber as unknown as number,
    },
    fetchFunction: async (o) =>
      (await metadataApi.listTvSeasonCrew(o.seriesId, o.seasonNumber)).data
        .crew,
  });

  const [
    searchConfiguration,
    searchConfigurationLoading,
    searchConfigurationError,
    fetchSearchConfiguration,
    setSearchConfiguration,
  ] = useFetch<number, MediaAssetSearchConfiguration>({
    dataType: "search configuration",
    watch: [tvSeason],
    params: tvSeason?.id,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await mediaApi.describeMediaAssetSearchConfiguration("tv_season", o))
        .data.searchConfiguration,
  });

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );

  if (tvSeason) {
    const headerBackgroundUrl = tvSeason?.series.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${tvSeason.series.backdropPath}`
      : "/section_header.png";
    const airDate = tvSeason.airDate
      ? DateTime.fromISO(tvSeason.airDate)
      : undefined;

    const overview = tvSeason.overview ? (
      <Space orientation={"vertical"} size={0}>
        <Typography.Title
          style={{ color: "#222222", marginBottom: 0 }}
          level={4}
        >
          Overview
        </Typography.Title>
        <Typography.Text style={{ color: "#333333", display: "flex" }}>
          {tvSeason?.overview}
        </Typography.Text>
      </Space>
    ) : undefined;

    const mainTabs = [
      {
        key: "t-main-general",
        label: "Overview",
        children: (
          <Space
            orientation={"vertical"}
            style={{
              width: "100%",
              padding: 16,
              alignItems: "start",
              justifyContent: "space-between",
              paddingRight: 32,
            }}
            styles={{ item: { width: "100%" } }}
          >
            {overview}
            {overview && (
              <Typography.Title
                style={{ color: "#222222", marginBottom: 0 }}
                level={4}
              >
                Episodes
              </Typography.Title>
            )}
            {tvSeason.episodes.map((entry) => {
              return (
                <TvEpisodeSummaryCard
                  episode={entry}
                  seriesId={tvSeason.series.id}
                  initialSearchConfiguration={entry.searchConfiguration}
                />
              );
            })}
          </Space>
        ),
      },
      {
        key: "t-main-cast",
        label: "Cast",
        children: (
          <Space orientation={"vertical"} style={{ width: "100%" }}>
            <LoadingWrapper
              loading={castLoading}
              error={castError}
              showError={true}
            >
              <TvSeriesCastList cast={cast} />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-crew",
        label: "Crew",
        children: (
          <Space
            orientation={"vertical"}
            style={{ width: "100%", padding: 16 }}
          >
            <LoadingWrapper
              loading={crewLoading}
              error={crewError}
              showError={true}
            >
              <TvSeriesCrewList crew={crew} />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-images",
        label: "Images",
        children: (
          <MovieImagesPanel images={tvSeason.images} imageTypes={["poster"]} />
        ),
      },
      {
        key: "t-main-videos",
        label: "Videos",
        children: <MovieVideoPanel videos={tvSeason.videos} />,
      },
    ];

    const sideTabs = [
      {
        key: "t-info-episodes",
        label: <CalendarOutlined />,
        children: (
          <Space orientation={"vertical"} style={{ margin: 0, width: "100%" }}>
            <SeasonEpisodeCalendar episodes={tvSeason.episodes} />
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
            orientation={"vertical"}
          >
            <QRCode
              style={{ marginTop: 64 }}
              size={350}
              bordered={false}
              errorLevel={"H"}
              value={`${OLYMPUS_HOST}/dionysus/tv/series/${tvSeason.series.id}/season/${tvSeason.seasonNumber}`}
            />
          </Space>
        ),
      },
      {
        key: "m-info-fetchJob",
        label: <CloudDownloadOutlined />,
        children: (
          <Space
            size={0}
            style={{ width: "100%", padding: 16 }}
            orientation={"vertical"}
          >
            <MetadataFetchJobPanel
              id={`${id}-${tvSeason.seasonNumber}`}
              type={"tv_seasons"}
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
          <Space
            orientation={"vertical"}
            style={{
              width: "100%",
              padding: 16,
              paddingRight: 32,
            }}
            styles={{ item: { width: "100%" } }}
          >
            {tvSeason.episodes.map((entry) => {
              return (
                <TvEpisodeSearchResultsCard
                  episode={entry}
                  seriesId={tvSeason.series.id}
                  initialSearchConfiguration={entry.searchConfiguration}
                />
              );
            })}
          </Space>
        ),
      });

      sideTabs.splice(-1, 0, {
        key: "t-info-searchConfig",
        label: <EyeOutlined />,
        children: (
          <Space
            orientation={"vertical"}
            style={{ width: "100%", padding: 16 }}
          >
            <Typography.Title level={5}>Search Executions:</Typography.Title>
            <SearchConfigurationPanel
              searchConfiguration={searchConfiguration}
            />
          </Space>
        ),
      });
    }

    const seasonDetails = (
      <Space orientation={"vertical"} style={{ padding: 16 }}>
        <Image
          src={`https://image.tmdb.org/t/p/w342/${tvSeason.posterPath}}`}
          width={275}
          style={{ borderRadius: 8 }}
          preview={false}
        />
        <Description
          title={"Air Date"}
          value={airDate ? airDate.toFormat("yyyy / MM / dd") : undefined}
        />
        <Description title={"Episodes"} value={tvSeason.episodeCount} />
        <ExternalIdsList ids={tvSeason.externalIds} />
      </Space>
    );

    const heroSpace = (
      <Space
        size={0}
        orientation={"vertical"}
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
          orientation={"horizontal"}
          size={0}
          style={{ display: "flex", alignItems: "center" }}
          styles={{ item: { height: 200 } }}
        >
          <Link href={`/dionysus/tv/series/${tvSeason.series.id}`}>
            <Image
              preview={false}
              style={{
                height: 150,
                width: 100,
                borderRadius: 8,
                margin: 24,
              }}
              src={`https://image.tmdb.org/t/p/w342/${tvSeason.series.posterPath}}`}
              alt={"Poster"}
            />
          </Link>
          <Space
            orientation={"vertical"}
            size={8}
            style={{ alignItems: "start", marginTop: 24 }}
          >
            <Link href={`/dionysus/tv/series/${tvSeason.series.id}`}>
              <Typography.Title
                level={1}
                style={{ color: "#ffffffdd", marginBottom: 0 }}
              >
                {tvSeason?.series.name}
              </Typography.Title>
            </Link>
            <Link
              href={`/dionysus/tv/series/${tvSeason.series.id}/season/${tvSeason.seasonNumber}`}
            >
              <Typography.Title
                level={4}
                style={{ color: "#ffffffcc", marginBottom: 3 }}
              >
                Season {tvSeason?.seasonNumber}
              </Typography.Title>
            </Link>
            <Space
              orientation={"horizontal"}
              size={16}
              style={{
                alignItems: "center",
                display: "flex",
              }}
            >
              <Progress
                type={"circle"}
                strokeColor={getProgressColor(tvSeason.voteAverage * 10)}
                percent={tvSeason.voteAverage * 10}
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
                      {percent}%
                    </Typography.Text>
                  );
                }}
                style={{
                  backgroundColor: "#99999933",
                  borderRadius: 48,
                  padding: 6,
                }}
              />
              <FavoriteButton
                mediaType={"tv_season"}
                mediaId={tvSeason.id}
                favorite={tvSeason.favorite !== undefined}
              />
              <Button
                className={"dionysus-action-button"}
                shape={"circle"}
                size={"large"}
                icon={<BookOutlined />}
              />
              <SearchConfigurationButton
                mediaType={"tv_season"}
                mediaId={tvSeason.id}
                seriesId={tvSeason.series.id}
                seasonNumber={tvSeason.seasonNumber}
                searchConfiguration={searchConfiguration}
                zIndex={10000}
                loading={searchConfigurationLoading || tvSeasonLoading}
                afterUpdate={async () => {
                  await fetchTvSeason(true);
                }}
              />
            </Space>
          </Space>
        </Space>
      </Space>
    );

    content = (
      <Layout
        style={{
          position: "relative",
          background: "#ffffff",
          overflowX: "hidden",
          overflowY: "scroll",
          scrollbarWidth: "none",
          height: "calc(100vh - 92px)",
        }}
      >
        {heroSpace}
        <Space
          orientation={"horizontal"}
          className={"person-fix"}
          style={{
            width: "100%",
            position: "relative",
            alignItems: "start",
          }}
        >
          {seasonDetails}
          <CollapsibleTabPanel
            panelId={"tvEpisode.side"}
            width={550}
            tabs={sideTabs}
            style={{
              width: "100%",
              scrollbarWidth: "none",
              position: "relative",
              height: `calc(100vh - 292px)`,

              zIndex: 4000,
            }}
            tabContentStyle={{
              scrollbarWidth: "none",
              height: `calc(100vh - 308px)`,
              overflowY: "scroll",
            }}
          >
            <Tabs
              style={{
                scrollbarWidth: "none",
                height: `calc(100vh - 292px)`,
                overflowY: "scroll",
              }}
              styles={{
                header: {
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  background: "#ffffff",
                },
              }}
              className={"fill compact collapsible-tabs"}
              activeKey={activeTab}
              onChange={(activeKey: string) => {
                setActiveTab(activeKey);
              }}
              tabPlacement={"top"}
              size={"small"}
              items={mainTabs}
            />
          </CollapsibleTabPanel>
        </Space>
      </Layout>
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
              <Link href={"/dionysus/tv/series"}>
                <Space size={4}>
                  <MetadataOutlinedIcon />
                  <span>TV Series</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <MetadataOutlinedIcon />
                <span>{tvSeason?.name ? tvSeason.name : "Loading..."}</span>
              </Space>
            ),
          },
        ]}
      />
      <LoadingWrapper loading={tvSeasonLoading} error={tvSeasonError}>
        {content}
      </LoadingWrapper>
    </>
  );
};

export default TvSeriesDetailPage;

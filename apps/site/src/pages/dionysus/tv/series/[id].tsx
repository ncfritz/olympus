import {
  BookOutlined,
  CloudDownloadOutlined,
  EyeOutlined,
  FontSizeOutlined,
  HomeOutlined,
  InfoCircleFilled,
  QrcodeOutlined,
} from "@ant-design/icons";
import type {
  BaseTvSeries,
  MediaAssetSearchConfiguration,
  TvSeries,
  TvSeriesCastMember,
  TvSeriesCrewMember,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Space,
  Spin,
  Typography,
  Tabs,
  Button,
  Tag,
  QRCode,
  Image,
  Avatar,
  Layout,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { type ReactNode, useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import mediaApi from "../../../../api/mediaApi";
import metadataApi from "../../../../api/metadataApi";
import Description from "../../../../components/common/Description";
import LoadingWrapper from "../../../../components/common/LoadingWrapper";
import FavoriteButton from "../../../../components/dionysus/media/FavoriteButton";
import SearchConfigurationPanel from "../../../../components/dionysus/media/SearchConfigurationPanel";
import ExternalIdsList from "../../../../components/dionysus/metadata/ExternalIdsList";
import MetadataFetchJobPanel from "../../../../components/dionysus/metadata/MetadataFetchJobPanel";
import MovieAlternativeTitlesList from "../../../../components/dionysus/metadata/MovieAlternativeTitlesList";
import MovieImagesPanel from "../../../../components/dionysus/metadata/MovieImagesPanel";
import MovieProductionCompaniesPanel from "../../../../components/dionysus/metadata/MovieProductionCompaniesPanel";
import MovieVideoPanel from "../../../../components/dionysus/metadata/MovieVideoPanel";
import SearchConfigurationButton from "../../../../components/dionysus/media/SearchConfigurationButton";
import PopularityIndicator from "../../../../components/dionysus/metadata/PopulairtyIndicator";
import TvCastList from "../../../../components/dionysus/metadata/TvCastList";
import TvEpisodeSummaryCard from "../../../../components/dionysus/metadata/TvEpisodeSummaryCard";
import TvSeasonSummaryCard from "../../../../components/dionysus/metadata/TvSeasonSummaryCard";
import TvSeriesCastList from "../../../../components/dionysus/metadata/TvSeriesCastList";
import TvSeriesCrewList from "../../../../components/dionysus/metadata/TvSeriesCrewList";
import TvSeriesList from "../../../../components/dionysus/metadata/TvSeriesList";
import TvSeriesPosterCard from "../../../../components/dionysus/metadata/TvSeriesPosterCard";
import CollapsibleTabPanel from "../../../../components/layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../../icons";
import { OLYMPUS_HOST } from "../../../../utils/constants";

const TvSeriesDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id, tab } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");
  const [affix, setAffix] = useState(false);

  const [latestSeasonSearchConfiguration, setLatestSeasonSearchConfiguration] =
    useState<MediaAssetSearchConfiguration | undefined>(undefined);

  const [tvSeries, tvSeriesLoading, tvSeriesError, fetchTvSeries] = useFetch<
    number,
    TvSeries
  >({
    dataType: "TV series details",
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.describeTvSeries(o)).data.tvSeries,
  });

  const [cast, castLoading, castError] = useFetch<
    TvSeries,
    TvSeriesCastMember[]
  >({
    dataType: "TV series cast",
    watch: [tvSeries?.id],
    params: tvSeries,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await metadataApi.listTvSeriesCast(o.id)).data.cast,
  });

  const [crew, crewLoading, crewError] = useFetch<
    TvSeries,
    TvSeriesCrewMember[]
  >({
    dataType: "TV series crew",
    watch: [tvSeries?.id],
    params: tvSeries,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await metadataApi.listTvSeriesCrew(o.id)).data.crew,
  });

  const [
    recommendations,
    recommendationsLoading,
    recommendationsError,
    fetchRecommendations,
  ] = useFetch<TvSeries, BaseTvSeries[]>({
    dataType: "movie recommendations",
    watch: [tvSeries?.id],
    params: tvSeries,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await metadataApi.listTvSeriesRecommendations(o.id)).data
        .recommendations,
  });

  const [
    searchConfiguration,
    searchConfigurationLoading,
    ,
    ,
    setSearchConfiguration,
  ] = useFetch<TvSeries, MediaAssetSearchConfiguration>({
    dataType: "search configuration",
    watch: [tvSeries?.id],
    params: tvSeries,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await mediaApi.describeMediaAssetSearchConfiguration("tv_series", o.id))
        .data.searchConfiguration,
  });

  useEffect(() => {
    if (tvSeries) {
      setLatestSeasonSearchConfiguration(
        tvSeries.seasons[0].searchConfiguration,
      );
    }
  }, [tvSeries]);

  useEffect(() => {
    setAffix(false);

    if (tab === "sr") {
      setActiveTab("t-main-searchResults");
    } else {
      setActiveTab("t-main-general");
    }
  }, [id]);

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );

  if (tvSeries) {
    const headerBackgroundUrl = tvSeries?.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${tvSeries.backdropPath}`
      : "/section_header.png";

    const tagline = tvSeries.tagline ? (
      <Typography.Text
        italic={true}
        style={{
          color: "#d3d3d3",
          maxWidth: 1024,
          display: "flex",
          fontSize: "14px",
        }}
      >
        {tvSeries?.tagline}
      </Typography.Text>
    ) : undefined;

    const titleDecorations: ReactNode[] = [];

    if (tvSeries.genres && tvSeries.genres.length > 0) {
      titleDecorations.push(
        <Space orientation={"horizontal"} size={4}>
          {tvSeries.genres.map((genre) => {
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

    const overview = tvSeries.overview ? (
      <Space orientation={"vertical"} size={0}>
        <Typography.Title
          style={{ color: "#efefef", marginBottom: 0 }}
          level={4}
        >
          Overview
        </Typography.Title>
        <Typography.Text
          style={{ color: "#efefef", maxWidth: 1024, display: "flex" }}
        >
          {tvSeries?.overview}
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
            style={{ width: "100%", padding: 16 }}
          >
            <Space
              orientation={"horizontal"}
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
              <TvCastList cast={cast?.length > 0 ? cast.slice(0, 12) : []} />
            </LoadingWrapper>
            {tvSeries.lastEpisodeToAir && (
              <Space orientation={"vertical"} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ marginBottom: 0 }}>
                  Latest Episode
                </Typography.Title>
                <TvEpisodeSummaryCard
                  episode={tvSeries.lastEpisodeToAir}
                  seriesId={tvSeries.id}
                  initialSearchConfiguration={
                    tvSeries.lastEpisodeToAir.searchConfiguration
                  }
                />
              </Space>
            )}
            {tvSeries.nextEpisodeToAir && (
              <Space orientation={"vertical"} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ marginBottom: 0 }}>
                  Next Episode
                </Typography.Title>
                <TvEpisodeSummaryCard
                  episode={tvSeries.nextEpisodeToAir}
                  seriesId={tvSeries.id}
                  initialSearchConfiguration={
                    tvSeries.nextEpisodeToAir.searchConfiguration
                  }
                />
              </Space>
            )}
            {tvSeries.seasons.length > 0 && (
              <Space orientation={"vertical"} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ marginBottom: 0 }}>
                  Latest Season
                </Typography.Title>
                <TvSeasonSummaryCard
                  seriesId={tvSeries.id}
                  season={tvSeries.seasons[0]}
                  initialSearchConfiguration={
                    latestSeasonSearchConfiguration ||
                    tvSeries.seasons[0].searchConfiguration
                  }
                  afterSearchUpdate={async (searchConfiguration) => {
                    if (
                      searchConfiguration.seasonNumber ===
                      tvSeries.seasons[0].seasonNumber
                    ) {
                      setLatestSeasonSearchConfiguration(searchConfiguration);
                    }
                  }}
                />
              </Space>
            )}
            <Space
              orientation={"horizontal"}
              style={{
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
              size={16}
            >
              <Typography.Title level={4} style={{ marginBottom: 0 }}>
                Recommendations
              </Typography.Title>
              <Button
                size={"small"}
                ghost={true}
                type={"text"}
                onClick={() => {
                  setActiveTab("t-main-recommendations");
                }}
              >
                All Recommendations
              </Button>
            </Space>
            <LoadingWrapper
              loading={recommendationsLoading}
              error={recommendationsError}
              showError={true}
            >
              <TvSeriesList
                loading={recommendationsLoading}
                columns={8}
                tvSeries={
                  recommendations?.length > 0 ? recommendations.slice(0, 8) : []
                }
              />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-seasons",
        label: "Seasons",
        children: (
          <Space
            orientation={"vertical"}
            style={{ width: "100%", padding: 16 }}
          >
            {tvSeries.seasons.map((entry) => {
              return (
                <TvSeasonSummaryCard
                  seriesId={tvSeries.id}
                  season={entry}
                  initialSearchConfiguration={
                    entry.seasonNumber === tvSeries.seasons[0].seasonNumber
                      ? latestSeasonSearchConfiguration
                      : entry.searchConfiguration
                  }
                  afterSearchUpdate={async (searchConfiguration) => {
                    if (
                      searchConfiguration.seasonNumber ===
                      tvSeries.seasons[0].seasonNumber
                    ) {
                      setLatestSeasonSearchConfiguration(searchConfiguration);
                    }
                  }}
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
          <Space orientation={"vertical"} style={{ width: "100%" }}>
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
        key: "t-main-recommendations",
        label: "Recommendations",
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
              <TvSeriesList
                tvSeries={recommendations}
                loading={recommendationsLoading}
                columns={8}
                afterSearchUpdate={async () => {
                  await fetchRecommendations(true);
                }}
              />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-images",
        label: "Images",
        children: <MovieImagesPanel images={tvSeries.images} />,
      },
      {
        key: "t-main-videos",
        label: "Videos",
        children: <MovieVideoPanel videos={tvSeries.videos} />,
      },
      {
        key: "t-main-prodCompany",
        label: "Production Companies",
        children: (
          <Space
            orientation={"vertical"}
            style={{ width: "100%", padding: 16 }}
          >
            <MovieProductionCompaniesPanel
              productionCompanies={tvSeries.productionCompanies}
            />
          </Space>
        ),
      },
    ];

    const sideTabs = [
      {
        key: "t-info-general",
        label: <InfoCircleFilled />,
        children: (
          <Space orientation={"vertical"} style={{ margin: 12, width: "100%" }}>
            <Space
              orientation={"vertical"}
              style={{ width: "100%", paddingRight: 20 }}
            >
              <Description
                title={"Networks"}
                value={
                  tvSeries.networks.length > 0 ? (
                    <Space
                      size={8}
                      orientation={"horizontal"}
                      style={{ alignItems: "center" }}
                    >
                      <Link
                        href={`/dionysus/tv/networks/${tvSeries.networks[0].network.id}`}
                      >
                        <Image
                          src={`https://image.tmdb.org/t/p/w154/${tvSeries.networks[0].network.logoPath}`}
                          preview={false}
                          style={{ maxHeight: 48 }}
                        />
                      </Link>
                    </Space>
                  ) : (
                    "Unknown"
                  )
                }
              />
              <ExternalIdsList ids={tvSeries.externalIds} />
            </Space>
            <Description
              title={"Origin Countries"}
              value={
                tvSeries.originCountries.length > 0 ? (
                  <Space orientation={"vertical"} size={2}>
                    {tvSeries.originCountries.map((item) => {
                      return (
                        <Space
                          size={8}
                          orientation={"horizontal"}
                          style={{ alignItems: "center" }}
                        >
                          <ReactCountryFlag
                            countryCode={item.country.id}
                            cdnUrl={"/flags/"}
                            cdnSuffix={"svg"}
                            svg={true}
                          />
                          <Typography.Text style={{ fontSize: "10px" }}>
                            {item.country.name}
                          </Typography.Text>
                        </Space>
                      );
                    })}
                  </Space>
                ) : (
                  "Unknown"
                )
              }
            />
            <Description
              title={"Locations"}
              value={
                tvSeries.productionCountries.length > 0 ? (
                  <Space orientation={"vertical"} size={2}>
                    {tvSeries.productionCountries.map((item) => {
                      return (
                        <Space
                          size={8}
                          orientation={"horizontal"}
                          style={{ alignItems: "center" }}
                        >
                          <ReactCountryFlag
                            countryCode={item.country.id}
                            cdnUrl={"/flags/"}
                            cdnSuffix={"svg"}
                            svg={true}
                          />
                          <Typography.Text style={{ fontSize: "10px" }}>
                            {item.country.name}
                          </Typography.Text>
                        </Space>
                      );
                    })}
                  </Space>
                ) : (
                  "Unknown"
                )
              }
            />
            <Description
              title={"Original Language"}
              value={
                tvSeries.originalLanguage ? (
                  <Space orientation={"vertical"} size={8}>
                    <Space size={8} orientation={"horizontal"}>
                      <ReactCountryFlag
                        countryCode={tvSeries.originalLanguage.id}
                        cdnUrl={"/flags/"}
                        cdnSuffix={"svg"}
                        svg={true}
                      />
                      <Typography.Text style={{ fontSize: "11px" }}>
                        {tvSeries.originalLanguage.name}
                      </Typography.Text>
                      {tvSeries.originalLanguage.nativeName && (
                        <Typography.Text
                          style={{
                            color: "#666666",
                            fontSize: "10px",
                          }}
                        >
                          ({tvSeries.originalLanguage.nativeName})
                        </Typography.Text>
                      )}
                    </Space>
                  </Space>
                ) : (
                  "Unknown"
                )
              }
            />
            <Description
              title={"Spoken Languages"}
              value={
                tvSeries.spokenLanguages.length > 0 ? (
                  <Space orientation={"vertical"} size={8}>
                    {tvSeries.spokenLanguages.map((item) => {
                      return (
                        <Space size={8} orientation={"horizontal"}>
                          <ReactCountryFlag
                            countryCode={item.language.id}
                            cdnUrl={"/flags/"}
                            cdnSuffix={"svg"}
                            svg={true}
                          />
                          <Typography.Text style={{ fontSize: "11px" }}>
                            {item.language.name}
                          </Typography.Text>
                          {item.language.nativeName && (
                            <Typography.Text
                              style={{
                                color: "#666666",
                                fontSize: "10px",
                              }}
                            >
                              ({item.language.nativeName})
                            </Typography.Text>
                          )}
                        </Space>
                      );
                    })}
                  </Space>
                ) : (
                  "Unknown"
                )
              }
            />
            <Description
              title={"Keywords"}
              value={
                tvSeries.keywords.length > 0 ? (
                  <Space
                    size={4}
                    orientation={"horizontal"}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      marginRight: 16,
                    }}
                  >
                    {tvSeries.keywords.map((item) => {
                      return (
                        <Tag
                          key={`kw-${item.keyword.id}`}
                          style={{ marginBottom: 8 }}
                          variant={"filled"}
                          color={"#999999"}
                        >
                          {item.keyword.value}
                        </Tag>
                      );
                    })}
                  </Space>
                ) : (
                  "No keywords"
                )
              }
            />
          </Space>
        ),
      },
      {
        key: "m-info-altTitle",
        label: <FontSizeOutlined />,
        children: (
          <Space
            size={0}
            style={{ width: "100%", padding: 16 }}
            orientation={"vertical"}
          >
            <Typography.Title level={5}>Alternative Titles:</Typography.Title>
            <MovieAlternativeTitlesList
              alternativeTitles={tvSeries.alternativeTitles}
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
            orientation={"vertical"}
          >
            <QRCode
              style={{ marginTop: 64 }}
              size={350}
              bordered={false}
              errorLevel={"H"}
              value={`${OLYMPUS_HOST}/dionysus/tv/series/${tvSeries.id}`}
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
            <MetadataFetchJobPanel id={tvSeries.id} type={"tv_series"} />
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
            style={{ width: "100%", padding: 16 }}
          >
            fff
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

    const tvSeriesActions = (
      <Space
        orientation={"horizontal"}
        size={16}
        style={{ marginTop: 16, alignItems: "center" }}
      >
        <PopularityIndicator
          popularity={tvSeries.popularity}
          voteCount={tvSeries.voteCount}
          voteAverage={tvSeries.voteAverage}
        />
        <Space
          size={16}
          orientation={"horizontal"}
          style={{ left: -48, position: "relative" }}
        >
          <FavoriteButton
            mediaType={"tv_series"}
            mediaId={tvSeries.id}
            favorite={tvSeries.favorite !== undefined}
          />
          <Button
            className={"dionysus-action-button"}
            shape={"circle"}
            size={"large"}
            icon={<BookOutlined />}
          />
          <SearchConfigurationButton
            mediaType={"tv_series"}
            mediaId={tvSeries.id}
            seriesId={tvSeries.id}
            searchConfiguration={searchConfiguration}
            loading={searchConfigurationLoading || tvSeriesLoading}
            afterUpdate={async (searchConfiguration) => {
              setSearchConfiguration(searchConfiguration);
              await fetchTvSeries(true);
            }}
          />
        </Space>
      </Space>
    );

    let heroSpace: ReactNode;

    if (affix) {
      heroSpace = (
        <Space
          size={0}
          orientation={"vertical"}
          className={"movieHeader"}
          style={{
            position: "sticky",
            minHeight: 522,
            maxHeight: 522,
            width: "100%",
            top: 0,
            zIndex: 5,
          }}
          styles={{
            item: { width: "100%" },
          }}
        >
          <Space
            size={0}
            orientation={"vertical"}
            className={"movieHeader"}
            style={{
              height: 200,
              width: "100%",
              backgroundColor: "#021629",
              backgroundImage: `linear-gradient(90deg, rgba(0, 21, 41, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
              backgroundPosition: "left 350px top",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              alignItems: "start",
            }}
            styles={{
              item: { width: "100%" },
            }}
            onWheel={(e) => {
              if (affix && e.currentTarget.scrollTop === 0 && e.deltaY < 0) {
                setAffix(false);
              }
            }}
          >
            <Space
              orientation={"horizontal"}
              size={0}
              style={{ display: "flex", alignItems: "center" }}
              styles={{ item: { height: 200 } }}
            >
              <Space
                orientation={"horizontal"}
                style={{ margin: 16, marginRight: 32 }}
              >
                <TvSeriesPosterCard
                  tvSeries={tvSeries}
                  bordered={false}
                  showStatus={true}
                  scaleDirection={"vertical"}
                  scaleBaseline={150}
                  enablePopover={false}
                />
              </Space>
              <Space
                orientation={"vertical"}
                size={8}
                style={{ alignItems: "start", marginTop: 16 }}
              >
                <Typography.Title
                  level={1}
                  style={{ color: "#ffffffdd", marginBottom: 3 }}
                >
                  {tvSeries?.name}
                </Typography.Title>
                <Space orientation={"horizontal"}>{titleDecorations}</Space>
                {tvSeriesActions}
              </Space>
            </Space>
          </Space>
        </Space>
      );
    } else {
      heroSpace = (
        <Space
          size={0}
          orientation={"vertical"}
          className={"movieHeader"}
          style={{
            minHeight: 522,
            maxHeight: 522,
            width: "100%",
            backgroundColor: "#021629",
            backgroundImage: `linear-gradient(90deg, rgba(0, 21, 41, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
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
            orientation={"horizontal"}
            size={32}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "start",
              marginTop: 32,
            }}
          >
            <Space
              orientation={"vertical"}
              size={0}
              style={{ marginLeft: 32, marginBottom: 32 }}
            >
              <TvSeriesPosterCard
                tvSeries={tvSeries}
                showStatus={true}
                scaleDirection={"horizontal"}
                scaleBaseline={300}
                bordered={false}
              />
            </Space>
            <Space
              orientation={"vertical"}
              style={{ width: "100%", height: "100%", alignItems: "top" }}
            >
              <Typography.Title
                level={1}
                style={{ color: "#ffffffdd", marginBottom: 3 }}
              >
                {tvSeries?.name}
              </Typography.Title>
              <Space orientation={"horizontal"}>{titleDecorations}</Space>
              {tvSeriesActions}
              <Space orientation={"vertical"} style={{ marginTop: 16 }}>
                {tagline}
                {overview}
                {tvSeries.createdBy.length > 0 && (
                  <Space orientation={"vertical"} size={0}>
                    <Typography.Title
                      style={{
                        color: "#efefef",
                        marginBottom: 8,
                        marginTop: 16,
                      }}
                      level={4}
                    >
                      Created By
                    </Typography.Title>
                    <Space orientation={"horizontal"} size={32}>
                      {tvSeries.createdBy.map((entry) => {
                        return (
                          <Space orientation={"horizontal"} size={8}>
                            <Avatar
                              shape={"circle"}
                              size={64}
                              style={{ border: "2px solid #efefef99" }}
                              src={`https://image.tmdb.org/t/p/w185/${entry.person.profilePath}`}
                            />
                            <Link
                              href={`https://olympus.dev.ncfritz.net/dionysus/person/${entry.person.id}`}
                            >
                              <Typography.Text
                                style={{ color: "#efefef", marginBottom: 0 }}
                              >
                                {entry.person.name}
                              </Typography.Text>
                            </Link>
                          </Space>
                        );
                      })}
                    </Space>
                  </Space>
                )}
              </Space>
            </Space>
          </Space>
        </Space>
      );
    }

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
        onScroll={(e) => {
          if (!affix) {
            setAffix(e.currentTarget.scrollTop >= 319);
          }
        }}
      >
        {heroSpace}
        <Space
          orientation={"horizontal"}
          style={{
            width: "100%",
            position: "relative",
            marginTop: affix ? -322 : -546,
            top: affix ? undefined : 546,
          }}
          styles={{
            item: {
              width: "100%",
            },
          }}
        >
          <CollapsibleTabPanel
            panelId={"tvSeries.side"}
            width={550}
            tabs={sideTabs}
            style={{
              width: "100%",
              height: affix ? `calc(100vh - 292px)` : undefined,
              scrollbarWidth: "none",
              position: "relative",
              zIndex: 4,
            }}
            tabContentStyle={{
              scrollbarWidth: "none",
              height: affix ? `calc(100vh - 308px)` : undefined,
              overflowY: "scroll",
              paddingTop: 16,
            }}
          >
            <Tabs
              style={{
                scrollbarWidth: "none",
                height: affix ? `calc(100vh - 292px)` : undefined,
                overflowY: "scroll",
              }}
              styles={{
                header: {
                  position: "sticky",
                  top: 0,
                  zIndex: 50,
                  background: "#ffffff",
                },
              }}
              className={"fill compact collapsible-tabs"}
              activeKey={activeTab}
              onChange={(activeKey: string) => {
                setActiveTab(activeKey);
              }}
              onWheel={(e) => {
                if (affix && e.currentTarget.scrollTop === 0 && e.deltaY < 0) {
                  setAffix(false);
                }
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
                <span>{tvSeries?.name ? tvSeries.name : "Loading..."}</span>
              </Space>
            ),
          },
        ]}
      />
      <LoadingWrapper loading={tvSeriesLoading} error={tvSeriesError}>
        {content}
      </LoadingWrapper>
    </>
  );
};

export default TvSeriesDetailPage;

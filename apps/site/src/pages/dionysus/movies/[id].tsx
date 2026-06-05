import {
  BookOutlined,
  CalendarOutlined,
  CloudDownloadOutlined,
  EyeOutlined,
  FileOutlined,
  FontSizeOutlined,
  HeartOutlined,
  HomeOutlined,
  InfoCircleFilled,
  QrcodeOutlined,
  SafetyCertificateTwoTone,
} from "@ant-design/icons";
import type {
  Collection,
  MediaAssetSearchConfiguration,
  Movie,
  MovieCastMember,
  MovieCrewMember,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Space,
  Spin,
  Typography,
  Tabs,
  Button,
  Tag,
  Progress,
  QRCode,
  type TabsProps,
  Drawer,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import mediaApi from "../../../api/mediaApi";
import metadataApi from "../../../api/metadataApi";
import Description from "../../../components/common/Description";
import LoadingWrapper from "../../../components/common/LoadingWrapper";
import AssetDetailsPanel from "../../../components/dionysus/media/AssetDetailsPanel";
import SearchConfigurationPanel from "../../../components/dionysus/media/SearchConfigurationPanel";
import SearchResultsTable from "../../../components/dionysus/media/SearchResultsTable";
import ExternalIdsList from "../../../components/dionysus/metadata/ExternalIdsList";
import MetadataFetchJobPanel from "../../../components/dionysus/metadata/MetadataFetchJobPanel";
import MovieAlternativeTitlesList from "../../../components/dionysus/metadata/MovieAlternativeTitlesList";
import MovieCastList from "../../../components/dionysus/metadata/MovieCastList";
import MovieCollectionCard from "../../../components/dionysus/metadata/MovieCollectionCard";
import MovieCrewList from "../../../components/dionysus/metadata/MovieCrewList";
import MovieImagesPanel from "../../../components/dionysus/metadata/MovieImagesPanel";
import MovieList from "../../../components/dionysus/metadata/MovieList";
import MoviePosterCard from "../../../components/dionysus/metadata/MoviePosterCard";
import MovieProductionCompaniesPanel from "../../../components/dionysus/metadata/MovieProductionCompaniesPanel";
import MovieReleaseDateList from "../../../components/dionysus/metadata/MovieReleaseDatesList";
import MovieVideoPanel from "../../../components/dionysus/metadata/MovieVideoPanel";
import SearchConfigurationButton from "../../../components/dionysus/media/SearchConfigurationButton";
import { getProgressColor } from "../../../components/dionysus/metadata/util";
import CollapsibleTabPanel from "../../../components/layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../icons";
import { OLYMPUS_HOST } from "../../../utils/constants";

const MovieDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");
  const [assetInfoOpen, setAssetInfoOpen] = useState(false);

  const [movie, movieLoading, movieError] = useFetch<number, Movie>({
    dataType: "movie details",
    watch: [id],
    params: id as unknown as number,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) => (await metadataApi.describeMovie(o)).data.movie,
  });

  const [cast, castLoading, castError] = useFetch<number, MovieCastMember[]>({
    dataType: "movie cast list",
    watch: [movie?.id],
    params: id as unknown as number,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) => (await metadataApi.listMovieCast(o)).data.cast,
  });

  const [crew, crewLoading, crewError] = useFetch<number, MovieCrewMember[]>({
    dataType: "movie crew list",
    watch: [movie?.id],
    params: id as unknown as number,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) => (await metadataApi.listMovieCrew(o)).data.crew,
  });

  const [
    recommendations,
    recommendationsLoading,
    recommendationsError,
    fetchRecommendations,
  ] = useFetch<number, SparseMovie[]>({
    dataType: "movie recommendations",
    watch: [movie?.id],
    params: id as unknown as number,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await metadataApi.listMovieRecommendations(o)).data.recommendations,
  });

  const [collections, collectionsLoading, collectionsError, fetchCollections] =
    useFetch<number, Collection[]>({
      dataType: "movie collections list",
      watch: [movie?.id],
      params: id as unknown as number,
      validateOptions: (o) => o !== undefined,
      fetchFunction: async (o) =>
        (await metadataApi.listMovieCollections(o)).data.collections,
    });

  const [
    searchConfiguration,
    searchConfigurationLoading,
    searchConfigurationError,
    fetchSearchConfiguration,
    setSearchConfiguration,
  ] = useFetch<number, MediaAssetSearchConfiguration>({
    dataType: "search configuration",
    watch: [movie?.id],
    params: id as unknown as number,
    validateOptions: (o) => o !== undefined,
    fetchFunction: async (o) =>
      (await mediaApi.describeMediaAssetSearchConfiguration("movie", o)).data
        .searchConfiguration,
  });

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );

  if (movie) {
    const headerBackgroundUrl = movie?.backdropPath
      ? `https://image.tmdb.org/t/p/w1280/${movie.backdropPath}`
      : "/section_header.png";

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

    const overview = movie.overview ? (
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
          {movie?.overview}
        </Typography.Text>
      </Space>
    ) : undefined;

    const mainTabs: TabsProps["items"] = [
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
              <MovieCastList
                filterable={false}
                defaultLayout={"grid"}
                cast={cast?.length > 0 ? cast.slice(0, 12) : []}
              />
            </LoadingWrapper>
            <LoadingWrapper
              loading={collectionsLoading}
              error={collectionsError}
              showError={true}
              style={{ width: "100%" }}
            >
              <MovieCollectionCard
                collection={
                  collections?.length > 0 ? collections[0] : undefined
                }
                afterSearchUpdate={async (searchConfiguration) => {
                  await fetchCollections(true);

                  if (searchConfiguration.mediaId === movie.id) {
                    setSearchConfiguration(searchConfiguration);
                  }
                }}
              />
            </LoadingWrapper>
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
              error={castError}
              showError={true}
            >
              <MovieList
                loading={recommendationsLoading}
                columns={8}
                movies={
                  recommendations?.length > 0 ? recommendations.slice(0, 8) : []
                }
                afterSearchUpdate={async () => {
                  await fetchRecommendations(true);
                }}
              />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-cast",
        label: "Cast",
        children: (
          <Space orientation={"vertical"} style={{ width: "100%" }}>
            <LoadingWrapper
              loading={crewLoading}
              error={crewError}
              showError={true}
            >
              <MovieCastList cast={cast} />
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
              <MovieCrewList crew={crew} />
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
              <MovieList
                movies={recommendations}
                loading={recommendationsLoading}
                columns={8}
              />
            </LoadingWrapper>
          </Space>
        ),
      },
      {
        key: "t-main-images",
        label: "Images",
        children: <MovieImagesPanel images={movie.images} />,
      },
      {
        key: "t-main-videos",
        label: "Videos",
        children: <MovieVideoPanel videos={movie.videos} />,
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
              productionCompanies={movie.productionCompanies}
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
            <ExternalIdsList ids={movie.externalIds} />
            <Description
              title={"Budget"}
              value={
                movie.budget > 0
                  ? Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(movie.budget)
                  : "Unknown"
              }
            />
            <Description
              title={"Revenue"}
              value={
                movie.revenue > 0
                  ? Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(movie.revenue)
                  : "Unknown"
              }
            />
            <Description
              title={"Original Language"}
              value={
                movie.originalLanguage ? (
                  <Space size={8} orientation={"horizontal"}>
                    <ReactCountryFlag
                      countryCode={movie.originalLanguage.id}
                      cdnUrl={"/flags/"}
                      cdnSuffix={"svg"}
                      svg={true}
                    />
                    <Typography.Text>
                      {movie.originalLanguage.name}
                    </Typography.Text>
                  </Space>
                ) : (
                  "Unknown"
                )
              }
            />
            <Description
              title={"Locations"}
              value={
                movie.productionCountries.length > 0 ? (
                  <Space orientation={"vertical"} size={2}>
                    {movie.productionCountries.map((item) => {
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
              title={"Spoken Languages"}
              value={
                movie.spokenLanguages.length > 0 ? (
                  <Space orientation={"vertical"} size={8}>
                    {movie.spokenLanguages.map((item) => {
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
                movie.keywords.length > 0 ? (
                  <Space
                    size={0}
                    orientation={"horizontal"}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                    }}
                  >
                    {movie.keywords.map((item) => {
                      return (
                        <Tag
                          key={`kw-${item.keyword.id}`}
                          style={{ marginBottom: 8 }}
                          bordered={false}
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
        key: "t-info-releases",
        label: <CalendarOutlined />,
        children: (
          <Space
            size={0}
            style={{ width: "100%", padding: 16 }}
            orientation={"vertical"}
          >
            <Typography.Title level={5}>Release Dates:</Typography.Title>
            <MovieReleaseDateList releaseDates={movie.releaseDates} />
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
              alternativeTitles={movie.alternativeTitles}
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
            style={{ width: "100%", padding: 16 }}
            orientation={"vertical"}
          >
            <QRCode
              style={{ marginTop: 64 }}
              size={350}
              bordered={false}
              errorLevel={"H"}
              value={`${OLYMPUS_HOST}/dionysus/movies/${movie.id}`}
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
            <MetadataFetchJobPanel id={movie.id} type={"movies"} />
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
            style={{ width: "100%", display: "block" }}
          >
            <SearchResultsTable searchConfiguration={searchConfiguration} />
          </Space>
        ),
      });

      sideTabs.splice(-1, 0, {
        key: "t-info-searchConfig",
        label: <EyeOutlined />,
        children: (
          <Space orientation={"vertical"} style={{ width: "100%" }}>
            <SearchConfigurationPanel
              searchConfiguration={searchConfiguration}
            />
          </Space>
        ),
      });
    }

    content = (
      <Space
        orientation={"vertical"}
        size={0}
        style={{ width: "100%", height: "100%" }}
        styles={{ item: { width: "100%" } }}
      >
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
              <MoviePosterCard
                movie={movie}
                bordered={false}
                showReleaseStatus={true}
                scaleDirection={"horizontal"}
                scaleBaseline={300}
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
                <Space
                  orientation={"horizontal"}
                  size={8}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  {movie.asset && (
                    <SafetyCertificateTwoTone
                      twoToneColor={"#488633"}
                      style={{ fontSize: "32px" }}
                    />
                  )}
                  {movie?.title}
                </Space>
              </Typography.Title>
              <Space orientation={"horizontal"}>{titleDecorations}</Space>
              <Space
                orientation={"horizontal"}
                size={16}
                style={{ marginTop: 16 }}
              >
                <Progress
                  type={"circle"}
                  strokeColor={getProgressColor(movie.popularity * 10 || 0)}
                  percent={movie.voteAverage * 10}
                  size={64}
                  format={(percent) => {
                    return (
                      <Typography.Text
                        style={{
                          fontSize: "15px",
                          color: "#efefef",
                          fontWeight: 500,
                        }}
                      >
                        {percent?.toFixed(0)}%
                      </Typography.Text>
                    );
                  }}
                  style={{
                    backgroundColor: "#202f3e",
                    borderRadius: 48,
                    padding: 6,
                    zIndex: 99,
                    position: "relative",
                  }}
                />
                <Space
                  orientation={"vertical"}
                  style={{
                    background: "#202f3e",
                    height: 48,
                    borderRadius: 24,
                    paddingLeft: 36,
                    paddingRight: 24,
                    position: "relative",
                    left: -48,
                    gap: 0,
                    justifyContent: "center",
                    zIndex: 98,
                  }}
                >
                  <Space orientation={"horizontal"} size={8}>
                    <Typography.Text
                      strong={true}
                      style={{
                        color: "#ffffffdd",
                        marginBottom: 0,
                        fontSize: "10px",
                      }}
                    >
                      Vote Count:
                    </Typography.Text>
                    <Typography.Text
                      style={{
                        color: "#ffffffdd",
                        marginBottom: 0,
                        fontSize: "10px",
                      }}
                    >
                      {movie.voteCount.toLocaleString()}
                    </Typography.Text>
                  </Space>
                  <Space orientation={"horizontal"} size={8}>
                    <Typography.Text
                      strong={true}
                      style={{
                        color: "#ffffffdd",
                        marginBottom: 0,
                        fontSize: "10px",
                      }}
                    >
                      Popularity:
                    </Typography.Text>
                    <Typography.Text
                      style={{
                        color: "#ffffffdd",
                        marginBottom: 0,
                        fontSize: "10px",
                      }}
                    >
                      {movie.popularity.toFixed(2)}
                    </Typography.Text>
                  </Space>
                </Space>
                <Space
                  size={16}
                  orientation={"horizontal"}
                  style={{ left: -48, position: "relative" }}
                >
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
                    mediaType={"movie"}
                    mediaId={movie.id}
                    searchConfiguration={searchConfiguration}
                    loading={searchConfigurationLoading || movieLoading}
                    afterUpdate={async (searchConfiguration) => {
                      setSearchConfiguration(searchConfiguration);

                      if (collections.length > 0) {
                        await fetchCollections(true);
                      }
                    }}
                  />
                  {movie.asset && (
                    <Button
                      className={"dionysus-action-button"}
                      size={"large"}
                      icon={<FileOutlined />}
                      style={{
                        borderRadius: 32,
                        fontSize: "14px",
                      }}
                      onClick={() => setAssetInfoOpen(true)}
                    >
                      Asset Info
                    </Button>
                  )}
                </Space>
              </Space>
              <Space orientation={"vertical"} style={{ marginTop: 16 }}>
                {tagline}
                {overview}
              </Space>
            </Space>
          </Space>
        </Space>
        <Space
          orientation={"horizontal"}
          style={{ width: "100%", position: "relative" }}
          styles={{
            item: {
              width: "100%",
              minHeight: "calc(100vh - 673px)",
            },
          }}
        >
          <CollapsibleTabPanel
            panelId={"movie.side"}
            width={550}
            tabs={sideTabs}
            style={{
              width: "100%",
            }}
          >
            <Tabs
              className={"fill compact collapsible-tabs"}
              activeKey={activeTab}
              onChange={(activeKey: string) => {
                setActiveTab(activeKey);
              }}
              tabPosition={"top"}
              size={"small"}
              items={mainTabs}
            />
          </CollapsibleTabPanel>
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
                <span>{movie?.title ? movie.title : "Loading..."}</span>
              </Space>
            ),
          },
        ]}
      />
      <LoadingWrapper loading={movieLoading} error={movieError}>
        {content}
        <Drawer
          title={"Asset Details"}
          width={750}
          placement={"right"}
          closable={true}
          styles={{
            body: {
              padding: 0,
            },
          }}
          onClose={() => {
            setAssetInfoOpen(false);
          }}
          open={assetInfoOpen}
        >
          <AssetDetailsPanel assetType={"movie"} assetId={movie?.id} />
        </Drawer>
      </LoadingWrapper>
    </>
  );
};

export default MovieDetailPage;

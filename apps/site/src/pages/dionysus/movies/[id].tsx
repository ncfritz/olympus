import {
  BookOutlined,
  CalendarOutlined,
  CloudDownloadOutlined,
  EyeOutlined,
  FileOutlined,
  FontSizeOutlined,
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
  QRCode,
  type TabsProps,
  Drawer,
  Layout,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import prettyMilliseconds from "pretty-ms";
import React, { type ReactNode, useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import mediaApi from "../../../api/mediaApi";
import metadataApi from "../../../api/metadataApi";
import Description from "../../../components/common/Description";
import LoadingWrapper from "../../../components/common/LoadingWrapper";
import AssetDetailsPanel from "../../../components/dionysus/media/AssetDetailsPanel";
import FavoriteButton from "../../../components/dionysus/media/FavoriteButton";
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
import PopularityIndicator from "../../../components/dionysus/metadata/PopulairtyIndicator";
import CollapsibleTabPanel from "../../../components/layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../icons";
import { OLYMPUS_HOST } from "../../../utils/constants";

const MovieDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id, tab } = router.query;

  console.log(router.query);


  const [activeTab, setActiveTab] = useState("t-main-general");
  const [assetInfoOpen, setAssetInfoOpen] = useState(false);
  const [affix, setAffix] = useState(false);

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
          <Space
            orientation={"vertical"}
            style={{ margin: 12, paddingRight: 20, width: "100%" }}
          >
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
                    size={4}
                    orientation={"horizontal"}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      marginRight: 16,
                    }}
                  >
                    {movie.keywords.map((item) => {
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
            <SearchResultsTable
              searchConfiguration={searchConfiguration}
              containerHeight={affix ? 428 : 428}
            />
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

    const movieTitle = (
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
    );

    const movieActions = (
      <Space orientation={"horizontal"} size={16} style={{ marginTop: 8 }}>
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
          <FavoriteButton
            mediaType={"movie"}
            mediaId={movie.id}
            favorite={movie.favorite !== undefined}
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
          onWheel={(e) => {
            if (affix && e.currentTarget.scrollTop === 0 && e.deltaY < 0) {
              setAffix(false);
            }
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
                <MoviePosterCard
                  movie={movie}
                  bordered={false}
                  showReleaseStatus={true}
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
                {movieTitle}
                <Space orientation={"horizontal"}>{titleDecorations}</Space>
                {movieActions}
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
            position: "sticky",
            width: "100%",
            backgroundColor: "#021629",
            backgroundImage: `linear-gradient(90deg, rgba(0, 21, 41, 1) 10%, rgba(0, 0, 0, 0.4) 100%), url("${headerBackgroundUrl}")`,
            backgroundPosition: "left 350px top",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            borderBottom: "1px solid #efefef",
            alignItems: "start",
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
              {movieTitle}
              <Space orientation={"horizontal"} style={{ marginBottom: 8 }}>
                {titleDecorations}
              </Space>
              {movieActions}
              <Space orientation={"vertical"} style={{ marginTop: 16 }}>
                {tagline}
                {overview}
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
            panelId={"movie.side"}
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
                  zIndex: 5,
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
          size={750}
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

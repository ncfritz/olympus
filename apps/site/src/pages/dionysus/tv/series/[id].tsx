import {
  BookOutlined,
  CalendarOutlined,
  CloudDownloadOutlined,
  FontSizeOutlined,
  HeartOutlined,
  HomeOutlined,
  InfoCircleFilled,
  QrcodeOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type {
  BaseTvSeries,
  TvSeries,
  TvSeriesCastMember,
  TvSeriesCrewMember,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Breadcrumb,
  Layout,
  Space,
  Spin,
  Typography,
  Splitter,
  Tabs,
  Button,
  Tag,
  Progress,
  QRCode,
  Image,
  Avatar,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { type ReactNode, useState } from "react";
import ReactCountryFlag from "react-country-flag/src";
import metadataApi from "../../../../api/metadataApi";
import Description from "../../../../components/common/Description";
import LoadingWrapper from "../../../../components/common/LoadingWrapper";
import ExternalIdsList from "../../../../components/dionysus/metadata/ExternalIdsList";
import MetadataFetchJobPanel from "../../../../components/dionysus/metadata/MetadataFetchJobPanel";
import MovieAlternativeTitlesList from "../../../../components/dionysus/metadata/MovieAlternativeTitlesList";
import MovieImagesPanel from "../../../../components/dionysus/metadata/MovieImagesPanel";
import MovieProductionCompaniesPanel from "../../../../components/dionysus/metadata/MovieProductionCompaniesPanel";
import MovieVideoPanel from "../../../../components/dionysus/metadata/MovieVideoPanel";
import TvCastList from "../../../../components/dionysus/metadata/TvCastList";
import TvEpisodeSummaryCard from "../../../../components/dionysus/metadata/TvEpisodeSummaryCard";
import TvSeasonSummaryCard from "../../../../components/dionysus/metadata/TvSeasonSummaryCard";
import TvSeriesCastList from "../../../../components/dionysus/metadata/TvSeriesCastList";
import TvSeriesCrewList from "../../../../components/dionysus/metadata/TvSeriesCrewList";
import TvSeriesList from "../../../../components/dionysus/metadata/TvSeriesList";
import TvSeriesPosterCard from "../../../../components/dionysus/metadata/TvSeriesPosterCard";
import { getProgressColor } from "../../../../components/dionysus/metadata/util";
import { useFetch } from "../../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../../icons";

const TvSeriesDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");

  const [tvSeries, tvSeriesLoading, tvSeriesError] = useFetch<number, TvSeries>(
    {
      dataType: "TV series details",
      watch: [id],
      params: id as unknown as number,
      fetchFunction: async (o) =>
        (await metadataApi.describeTvSeries(o)).data.tvSeries,
    },
  );

  const [cast, castLoading, castError] = useFetch<number, TvSeriesCastMember[]>(
    {
      dataType: "TV series cast",
      watch: [id],
      params: id as unknown as number,
      fetchFunction: async (o) =>
        (await metadataApi.listTvSeriesCast(o)).data.cast,
    },
  );

  const [crew, crewLoading, crewError] = useFetch<number, TvSeriesCrewMember[]>(
    {
      dataType: "TV series crew",
      watch: [id],
      params: id as unknown as number,
      fetchFunction: async (o) =>
        (await metadataApi.listTvSeriesCrew(o)).data.crew,
    },
  );

  const [recommendations, recommendationsLoading, recommendationsError] =
    useFetch<number, BaseTvSeries[]>({
      dataType: "movie recommendations",
      watch: [id],
      params: id as unknown as number,
      fetchFunction: async (o) =>
        (await metadataApi.listTvSeriesRecommendations(o)).data.recommendations,
    });

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
        <Space direction={"horizontal"} size={4}>
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
      <Space direction={"vertical"} size={0}>
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
            top: 25,
          }}
          styles={{
            item: { width: "100%" },
          }}
        >
          <Breadcrumb
            className={"dark"}
            style={{
              padding: 8,
              background: "#021629",
              marginBottom: 32,
              position: "fixed",
              top: 64,
              left: 380,
              width: "100%",
              zIndex: 100,
            }}
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
                    <span>{tvSeries?.name ? tvSeries.name : "Loading..."}</span>
                  </Space>
                ),
              },
            ]}
          />
          <Space
            direction={"horizontal"}
            size={32}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "start",
              marginTop: 32,
            }}
          >
            <Space
              direction={"vertical"}
              size={0}
              style={{ marginLeft: 32, marginBottom: 32 }}
            >
              <TvSeriesPosterCard
                tvSeries={tvSeries}
                showStatus={true}
                scaleDirection={"horizontal"}
                scaleBaseline={300}
              />
            </Space>
            <Space
              direction={"vertical"}
              style={{ width: "100%", height: "100%", alignItems: "top" }}
            >
              <Typography.Title
                level={1}
                style={{ color: "#ffffffdd", marginBottom: 3 }}
              >
                {tvSeries?.name}
              </Typography.Title>
              <Space direction={"horizontal"}>{titleDecorations}</Space>
              <Space
                direction={"horizontal"}
                size={16}
                style={{ marginTop: 16, alignItems: "center" }}
              >
                <Progress
                  type={"circle"}
                  strokeColor={getProgressColor(tvSeries.popularity * 10 || 0)}
                  percent={tvSeries.voteAverage * 10}
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
                  direction={"vertical"}
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
                  <Space direction={"horizontal"} size={8}>
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
                      {tvSeries.voteCount.toLocaleString()}
                    </Typography.Text>
                  </Space>
                  <Space direction={"horizontal"} size={8}>
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
                      {tvSeries.popularity.toFixed(2)}
                    </Typography.Text>
                  </Space>
                </Space>
                <Space
                  size={16}
                  direction={"horizontal"}
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
                  <Button
                    className={"dionysus-action-button"}
                    shape={"circle"}
                    size={"large"}
                    icon={<SearchOutlined />}
                  />
                </Space>
              </Space>
              <Space direction={"vertical"} style={{ marginTop: 16 }}>
                {tagline}
                {overview}
                {tvSeries.createdBy.length > 0 && (
                  <Space direction={"vertical"} size={0}>
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
                    <Space direction={"horizontal"} size={32}>
                      {tvSeries.createdBy.map((entry) => {
                        return (
                          <Space direction={"horizontal"} size={8}>
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
        <Space
          direction={"horizontal"}
          style={{ width: "100%", top: 24, position: "relative" }}
          styles={{
            item: {
              width: "100%",
              minHeight: "calc(100vh - 673px",
            },
          }}
        >
          <Splitter
            style={{
              width: "100%",
              minHeight: "calc(100vh - 673px",
            }}
          >
            <Splitter.Panel>
              <Tabs
                className={"fill compact"}
                activeKey={activeTab}
                onChange={(activeKey: string) => {
                  setActiveTab(activeKey);
                }}
                tabPosition={"top"}
                size={"small"}
                items={[
                  {
                    key: "t-main-general",
                    label: "Overview",
                    children: (
                      <Space
                        direction={"vertical"}
                        style={{ width: "100%", padding: 16 }}
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
                          <Typography.Title
                            level={4}
                            style={{ marginBottom: 0 }}
                          >
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
                          <TvCastList
                            cast={cast?.length > 0 ? cast.slice(0, 12) : []}
                          />
                        </LoadingWrapper>
                        {tvSeries.lastEpisodeToAir && (
                          <Space
                            direction={"vertical"}
                            style={{ width: "100%" }}
                          >
                            <Typography.Title
                              level={4}
                              style={{ marginBottom: 0 }}
                            >
                              Latest Episode
                            </Typography.Title>
                            <TvEpisodeSummaryCard
                              episode={tvSeries.lastEpisodeToAir}
                              seriesId={tvSeries.id}
                            />
                          </Space>
                        )}
                        {tvSeries.nextEpisodeToAir && (
                          <Space
                            direction={"vertical"}
                            style={{ width: "100%" }}
                          >
                            <Typography.Title
                              level={4}
                              style={{ marginBottom: 0 }}
                            >
                              Next Episode
                            </Typography.Title>
                            <TvEpisodeSummaryCard
                              episode={tvSeries.nextEpisodeToAir}
                              seriesId={tvSeries.id}
                            />
                          </Space>
                        )}
                        {tvSeries.seasons.length > 0 && (
                          <Space
                            direction={"vertical"}
                            style={{ width: "100%" }}
                          >
                            <Typography.Title
                              level={4}
                              style={{ marginBottom: 0 }}
                            >
                              Latest Season
                            </Typography.Title>
                            <TvSeasonSummaryCard
                              seriesId={tvSeries.id}
                              season={tvSeries.seasons[0]}
                            />
                          </Space>
                        )}
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
                          <Typography.Title
                            level={4}
                            style={{ marginBottom: 0 }}
                          >
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
                          <TvSeriesList
                            loading={recommendationsLoading}
                            columns={8}
                            tvSeries={
                              recommendations?.length > 0
                                ? recommendations.slice(0, 8)
                                : []
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
                        direction={"vertical"}
                        style={{ width: "100%", padding: 16 }}
                      >
                        {tvSeries.seasons.map((entry) => {
                          return (
                            <TvSeasonSummaryCard
                              seriesId={tvSeries.id}
                              season={entry}
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
                      <Space direction={"vertical"} style={{ width: "100%" }}>
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
                      <Space direction={"vertical"} style={{ width: "100%" }}>
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
                        direction={"vertical"}
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
                        direction={"vertical"}
                        style={{ width: "100%", padding: 16 }}
                      >
                        <MovieProductionCompaniesPanel
                          productionCompanies={tvSeries.productionCompanies}
                        />
                      </Space>
                    ),
                  },
                ]}
              />
            </Splitter.Panel>
            <Splitter.Panel resizable={false} defaultSize={550}>
              <Tabs
                tabPosition={"right"}
                className={"compact"}
                items={[
                  {
                    key: "t-info-general",
                    label: <InfoCircleFilled />,
                    children: (
                      <Space
                        direction={"vertical"}
                        style={{ margin: 12, width: "100%" }}
                      >
                        <Space direction={"vertical"} style={{ width: "100%" }}>
                          <Description
                            title={"Networks"}
                            value={
                              tvSeries.networks.length > 0 ? (
                                <Space
                                  size={8}
                                  direction={"horizontal"}
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
                        </Space>
                        <ExternalIdsList ids={tvSeries.externalIds} />
                        <Description
                          title={"Origin Countries"}
                          value={
                            tvSeries.originCountries.length > 0 ? (
                              <Space direction={"vertical"} size={2}>
                                {tvSeries.originCountries.map((item) => {
                                  return (
                                    <Space
                                      size={8}
                                      direction={"horizontal"}
                                      style={{ alignItems: "center" }}
                                    >
                                      <ReactCountryFlag
                                        countryCode={item.country.id}
                                        cdnUrl={"/flags/"}
                                        cdnSuffix={"svg"}
                                        svg={true}
                                      />
                                      <Typography.Text
                                        style={{ fontSize: "10px" }}
                                      >
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
                              <Space direction={"vertical"} size={2}>
                                {tvSeries.productionCountries.map((item) => {
                                  return (
                                    <Space
                                      size={8}
                                      direction={"horizontal"}
                                      style={{ alignItems: "center" }}
                                    >
                                      <ReactCountryFlag
                                        countryCode={item.country.id}
                                        cdnUrl={"/flags/"}
                                        cdnSuffix={"svg"}
                                        svg={true}
                                      />
                                      <Typography.Text
                                        style={{ fontSize: "10px" }}
                                      >
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
                              <Space direction={"vertical"} size={8}>
                                <Space size={8} direction={"horizontal"}>
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
                              <Space direction={"vertical"} size={8}>
                                {tvSeries.spokenLanguages.map((item) => {
                                  return (
                                    <Space size={8} direction={"horizontal"}>
                                      <ReactCountryFlag
                                        countryCode={item.language.id}
                                        cdnUrl={"/flags/"}
                                        cdnSuffix={"svg"}
                                        svg={true}
                                      />
                                      <Typography.Text
                                        style={{ fontSize: "11px" }}
                                      >
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
                                size={0}
                                direction={"horizontal"}
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                }}
                              >
                                {tvSeries.keywords.map((item) => {
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
                        direction={"vertical"}
                      ></Space>
                    ),
                  },
                  {
                    key: "m-info-altTitle",
                    label: <FontSizeOutlined />,
                    children: (
                      <Space
                        size={0}
                        style={{ width: "100%", padding: 16 }}
                        direction={"vertical"}
                      >
                        <Typography.Title level={5}>
                          Alternative Titles:
                        </Typography.Title>
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
                        direction={"vertical"}
                      >
                        <QRCode
                          style={{ marginTop: 64 }}
                          size={350}
                          bordered={false}
                          errorLevel={"H"}
                          value={`https://dionysus.dev.ncfritz.net/dionysus/tv/series/${tvSeries.id}`}
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
                        direction={"vertical"}
                      >
                        <MetadataFetchJobPanel
                          id={tvSeries.id}
                          type={"tv_series"}
                        />
                      </Space>
                    ),
                  },
                ]}
              />
            </Splitter.Panel>
          </Splitter>
        </Space>
      </Space>
    );
  }

  return (
    <Layout
      style={{
        position: "fixed",
        background: "#ffffff",
        gap: 16,
        top: 64,
        overflowX: "hidden",
        overflowY: "auto",
        height: "calc(100vh - 64px)",
      }}
    >
      <Content style={{ width: "calc(100vw - 380px)" }}>{content}</Content>
    </Layout>
  );
};

export default TvSeriesDetailPage;

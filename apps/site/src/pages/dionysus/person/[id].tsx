import {
  CalendarOutlined,
  CloseCircleFilled,
  CloudDownloadOutlined,
  HomeOutlined,
  LinkOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import type {
  Person,
  PersonMovieCastCredit,
  PersonMovieCrewCredit,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Space,
  Spin,
  Typography,
  Tabs,
  Image,
  Button,
  Tag,
  QRCode,
  Layout,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import metadataApi from "../../../api/metadataApi";
import Description from "../../../components/common/Description";
import ExternalIdsList from "../../../components/dionysus/metadata/ExternalIdsList";
import MetadataFetchJobPanel from "../../../components/dionysus/metadata/MetadataFetchJobPanel";
import MovieList from "../../../components/dionysus/metadata/MovieList";
import PersonHistoryTimeline from "../../../components/dionysus/metadata/PersonHistoryTimeline";
import PersonImageList from "../../../components/dionysus/metadata/PersonImageList";
import CollapsibleTabPanel from "../../../components/layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../icons";
import { OLYMPUS_HOST } from "../../../utils/constants";

const PersonDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("t-main-general");

  const [person] = useFetch<string, Person>({
    dataType: "person details",
    watch: [id],
    params: id as string,
    fetchFunction: async (o) =>
      (await metadataApi.describePerson(o as unknown as number)).data.person,
  });

  const [castCredits, castCreditsLoading] = useFetch<
    number,
    PersonMovieCastCredit[]
  >({
    dataType: "cast credits",
    default: [],
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.listMovieCastRolesForPerson(o)).data.credits,
  });

  const [crewCredits, crewCreditsLoading] = useFetch<
    number,
    PersonMovieCrewCredit[]
  >({
    dataType: "cast credits",
    default: [],
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.listMovieCrewJobsForPerson(o)).data.credits,
  });

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );

  if (person) {
    const birthday = person.birthday
      ? DateTime.fromISO(person.birthday)
      : undefined;
    const deathday = person.deathday
      ? DateTime.fromISO(person.deathday)
      : undefined;
    const age = birthday
      ? Math.floor((deathday || DateTime.utc()).diff(birthday, "years").years)
      : "Unknown";

    const profilePathUrl = person?.profilePath
      ? `https://image.tmdb.org/t/p/w1280/${person.profilePath}`
      : "/section_header.png";

    const overview = (
      <Space orientation={"vertical"} size={0} style={{ marginRight: 16 }}>
        <Typography.Title
          style={{ color: "#666666", marginBottom: 0 }}
          level={4}
        >
          Biography
        </Typography.Title>
        {person.biography && person.biography.trim() !== "" ? (
          <Typography.Text style={{ fontSize: "11px", whiteSpace: "pre-line" }}>
            {person.biography}
          </Typography.Text>
        ) : (
          <Typography.Text italic={true} style={{ fontSize: "11px" }}>
            There is no biography available for {person.name}
          </Typography.Text>
        )}
      </Space>
    );

    const sideTabs = [
      {
        key: "t-info-timeline",
        label: <CalendarOutlined />,
        children: (
          <Space
            orientation={"vertical"}
            style={{ width: "100%", padding: 16 }}
          >
            <PersonHistoryTimeline
              movieRoles={castCredits}
              movieJobs={crewCredits}
            />
          </Space>
        ),
      },
      {
        key: "t-info-externalIds",
        label: <LinkOutlined />,
        children: <ExternalIdsList ids={person.externalIds} />,
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
              value={`${OLYMPUS_HOST}/dionysus/person/${person.id}`}
            />
          </Space>
        ),
      },
      {
        key: "t-info-fetchJob",
        label: <CloudDownloadOutlined />,
        children: (
          <Space
            size={0}
            style={{ width: "100%", padding: 16 }}
            orientation={"vertical"}
          >
            <MetadataFetchJobPanel id={person.id} type={"people"} />
          </Space>
        ),
      },
    ];

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
        <CollapsibleTabPanel
          panelId={"person.side"}
          width={550}
          tabs={sideTabs}
          style={{
            width: "100%",
            height: `calc(100vh - 92px)`,
            scrollbarWidth: "none",
            position: "relative",
            zIndex: 4,
          }}
          tabContentStyle={{
            scrollbarWidth: "none",
            height: `calc(100vh - 92px)`,
            overflowY: "scroll",
            paddingTop: 16,
          }}
        >
          <Space
            orientation={"vertical"}
            size={0}
            style={{ width: "100%", position: "relative", top: -16 }}
            styles={{ item: { width: "100%" } }}
          >
            <Space
              orientation={"horizontal"}
              className={"person-fix"}
              size={32}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "start",
              }}
            >
              <Space
                orientation={"vertical"}
                size={0}
                style={{ marginLeft: 32, paddingTop: 32 }}
              >
                <Image
                  src={profilePathUrl}
                  width={275}
                  style={{ borderRadius: 8 }}
                  preview={false}
                />
                {deathday && (
                  <Tag
                    color={"#222222"}
                    icon={<CloseCircleFilled />}
                    style={{ width: "100%", marginTop: 8 }}
                  >
                    Deceased
                  </Tag>
                )}
                <Space
                  orientation={"vertical"}
                  style={{ marginTop: 16, width: "100%" }}
                >
                  <Description
                    title={"Birthday"}
                    value={
                      birthday ? birthday.toFormat("yyyy / MM / dd") : undefined
                    }
                  />
                  <Description title={"Birthplace"} value={person.birthplace} />
                  {deathday && (
                    <Description
                      title={"Deathday"}
                      value={deathday.toFormat("yyyy / MM / dd")}
                    />
                  )}
                  <Description title={"Age"} value={age} />
                  <Description
                    title={"Known For"}
                    value={person.knownForDepartment}
                  />
                  <Description title={"Popularity"} value={person.popularity} />
                  {person.alsoKnownAs?.length > 0 && (
                    <Description
                      title={"Also Known As"}
                      value={
                        <Space orientation={"vertical"} size={2}>
                          {person.alsoKnownAs.map((item) => item.name)}
                        </Space>
                      }
                    />
                  )}
                </Space>
              </Space>
              <Space
                orientation={"vertical"}
                style={{
                  width: "100%",
                  alignItems: "top",
                  height: "calc(100vh - 87px)",
                  overflow: "scroll",
                  paddingTop: 32,
                }}
              >
                <Typography.Title level={1} style={{ marginBottom: 3 }}>
                  {person?.name}
                </Typography.Title>
                {overview}
                <Tabs
                  activeKey={activeTab}
                  onChange={(activeKey: string) => {
                    setActiveTab(activeKey);
                  }}
                  className={"fill"}
                  tabPlacement={"top"}
                  size={"small"}
                  items={[
                    {
                      key: "t-main-general",
                      label: "Overview",
                      children: (
                        <Space
                          orientation={"vertical"}
                          style={{ width: "100%", padding: 16 }}
                          styles={{
                            item: {
                              width: "100%",
                            },
                          }}
                        >
                          {castCredits.length > 0 && (
                            <Space
                              orientation={"vertical"}
                              style={{ width: "100%" }}
                            >
                              <Space
                                className={"person-fix-header"}
                                orientation={"horizontal"}
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
                                  Starring In...
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
                              <MovieList
                                columns={8}
                                movies={castCredits
                                  .filter((value) => {
                                    return value.movie.status === "Released";
                                  })
                                  .slice(0, 8)
                                  .map((i) => i.movie)}
                                loading={castCreditsLoading}
                              />
                            </Space>
                          )}
                          {crewCredits.length > 0 && (
                            <Space
                              orientation={"vertical"}
                              style={{ width: "100%" }}
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
                                <Typography.Title
                                  level={4}
                                  style={{ marginBottom: 0 }}
                                >
                                  Crew In...
                                </Typography.Title>
                                <Button
                                  size={"small"}
                                  ghost={true}
                                  type={"text"}
                                  onClick={() => {
                                    setActiveTab("t-main-crew");
                                  }}
                                >
                                  Full Crew List
                                </Button>
                              </Space>
                              <MovieList
                                columns={8}
                                movies={crewCredits
                                  .filter((value) => {
                                    return value.movie.status === "Released";
                                  })
                                  .slice(0, 8)
                                  .map((i) => i.movie)}
                                loading={crewCreditsLoading}
                              />
                            </Space>
                          )}
                        </Space>
                      ),
                    },
                    {
                      key: "t-main-cast",
                      label: "Cast",
                      children: (
                        <Space
                          orientation={"vertical"}
                          style={{ width: "100%", padding: 16 }}
                        >
                          <MovieList
                            columns={8}
                            movies={castCredits.map((i) => i.movie)}
                            loading={castCreditsLoading}
                          />
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
                          <MovieList
                            columns={8}
                            movies={crewCredits.map((i) => i.movie)}
                            loading={crewCreditsLoading}
                          />
                        </Space>
                      ),
                    },
                    {
                      key: "t-main-images",
                      label: "Images",
                      children: (
                        <Space
                          orientation={"vertical"}
                          style={{ width: "100%", padding: 16 }}
                        >
                          <PersonImageList images={person.images} />
                        </Space>
                      ),
                    },
                  ]}
                />
              </Space>
            </Space>
          </Space>
        </CollapsibleTabPanel>
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
              <Link href={"/dionysus/persons"}>
                <Space size={4}>
                  <MetadataOutlinedIcon />
                  <span>People</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <MetadataOutlinedIcon />
                <span>{person?.name ? person.name : "Loading..."}</span>
              </Space>
            ),
          },
        ]}
      />
      {content}
    </>
  );
};

export default PersonDetailPage;

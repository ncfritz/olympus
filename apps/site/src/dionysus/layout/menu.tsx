import {
  AppstoreOutlined,
  BarcodeOutlined,
  ExperimentOutlined,
  GroupOutlined,
  HomeOutlined,
  KubernetesOutlined,
  SearchOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Menu } from "antd";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  BatchJobIcon,
  CertificationsIcon,
  CollectionIcon,
  CountryIcon,
  DownloadsIcon,
  GenreIcon,
  KeywordIcon,
  LanguageIcon,
  MetadataOutlinedIcon, MetadataWorkflowIcon,
  MovieIcon,
  PeopleIcon,
  ProcessingQueueIcon,
  ProductionCompanyIcon,
  TranscodeIcon,
  TvIcon,
  TvNetworkIcon,
  WorkQueueIcon
} from "../../icons";
import { useAppSelector } from "../../redux/hooks";

const BASE_PATH = "dionysus";
const SUB_MENUS = {
  "/metadata": "metadata-container",
  "/content": "content-container",
  "/jobs": "jobs_container",
};

const DionysusMenu: React.FunctionComponent = () => {
  const router = useRouter();

  const submenuExpanded = useAppSelector(
    (state) => state.layout.submenuExpanded,
  );

  const [sideMenuItem, setSideMenuItem] = useState<string>("/");
  const [sideMenuSubMenuItems, setSideMenuSubMenuItems] = useState<string[]>(
    [],
  );

  useEffect(() => {
    const path = router.pathname;
    const items = [];

    for (const [key, value] of Object.entries(SUB_MENUS)) {
      if (path.startsWith(`/${BASE_PATH}${key}`)) {
        items.push(value);
      }
    }

    setSideMenuSubMenuItems(items);
    setSideMenuItem(path);
  }, [router]);

  const updateSubMenus = ({ key }: { key: string }) => {
    const items = [...sideMenuSubMenuItems];

    if (items.indexOf(key) > -1) {
      items.splice(items.indexOf(key), 1);
    } else {
      items.push(key);
    }
    console.log(items);

    setSideMenuSubMenuItems(items);
  };

  return (
    <Menu
      style={{
        width: submenuExpanded ? 300 : 80,
      }}
      theme={"light"}
      defaultSelectedKeys={["/"]}
      selectedKeys={[sideMenuItem]}
      openKeys={submenuExpanded ? sideMenuSubMenuItems : undefined}
      mode={"inline"}
      onSelect={({ item, key, keyPath, selectedKeys, domEvent }) => {
        setSideMenuItem(key);
        router.push(key, key, { shallow: true });
      }}
      items={[
        {
          key: `/${BASE_PATH}`,
          icon: <HomeOutlined />,
          label: "Home",
        },
        {
          key: `/${BASE_PATH}/queue`,
          icon: <ProcessingQueueIcon />,
          label: "Processing Queue",
        },
        {
          key: `/${BASE_PATH}/movies`,
          icon: <MovieIcon />,
          label: "Movies",
        },
        {
          key: `/${BASE_PATH}/tv/series`,
          icon: <TvIcon />,
          label: "TV Series",
        },
        {
          key: `/${BASE_PATH}/genres`,
          icon: <GenreIcon />,
          label: "Genres",
        },
        {
          key: `/${BASE_PATH}/people`,
          icon: <PeopleIcon />,
          label: "People",
        },
        {
          key: `/${BASE_PATH}/collections`,
          icon: <CollectionIcon />,
          label: "Collections",
        },
        {
          key: `/${BASE_PATH}/tv/networks`,
          icon: <TvNetworkIcon />,
          label: "TV Networks",
        },
        {
          key: `/${BASE_PATH}/productionCompanies`,
          icon: <ProductionCompanyIcon />,
          label: "Production Companies",
        },
        {
          type: "divider",
        },
        {
          key: "jobs_container",
          icon: <MetadataWorkflowIcon />,
          label: "Metadata Jobs",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/jobs/workflow`,
              icon: <KubernetesOutlined />,
              label: "Metadata Workflows",
            },
            {
              key: `/${BASE_PATH}/jobs/batch`,
              icon: <BatchJobIcon />,
              label: "Batch Jobs",
            },
            {
              key: `/${BASE_PATH}/jobs/metadata`,
              icon: <MetadataOutlinedIcon />,
              label: "Metadata Jobs",
            },
          ],
        },
        {
          key: "fetch_jobs_container",
          icon: <WorkQueueIcon />,
          label: "Media Fetch Jobs",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/jobs/nzb`,
              icon: <SearchOutlined />,
              label: "NZB Search Jobs",
            },
            {
              key: `/${BASE_PATH}/jobs/download`,
              icon: <DownloadsIcon />,
              label: "Download Jobs",
            },
            {
              key: `/${BASE_PATH}/jobs/transcode`,
              icon: <TranscodeIcon />,
              label: "Transcode Jobs",
            },
          ],
        },
        {
          key: "metadata-container",
          icon: <MetadataOutlinedIcon />,
          label: "Core Metadata",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/metadata/certifications`,
              icon: <CertificationsIcon />,
              label: "Certifications",
            },
            {
              key: `/${BASE_PATH}/metadata/countries`,
              icon: <CountryIcon />,
              label: "Countries",
            },
            {
              key: `/${BASE_PATH}/metadata/genres`,
              icon: <GenreIcon />,
              label: "Genres",
            },
            {
              key: `/${BASE_PATH}/metadata/keywords`,
              icon: <KeywordIcon />,
              label: "Keywords",
            },
            {
              key: `/${BASE_PATH}/metadata/languages`,
              icon: <LanguageIcon />,
              label: "Languages",
            },
          ],
        },
        {
          key: "content-container",
          icon: <ExperimentOutlined />,
          label: "Content",
          onTitleClick: updateSubMenus,
          children: [
            {
              key: `/${BASE_PATH}/content`,
              icon: <HomeOutlined />,
              label: "Main",
            },
            {
              key: `/${BASE_PATH}/content/assets`,
              icon: <VideoCameraOutlined />,
              label: "Assets",
            },
            {
              key: `/${BASE_PATH}/content/channels`,
              icon: <GroupOutlined />,
              label: "Channels",
            },
            {
              key: `/${BASE_PATH}/content/ingest`,
              icon: <UploadOutlined />,
              label: "Asset Ingest",
            },
            {
              key: `/${BASE_PATH}/content/process`,
              icon: <BarcodeOutlined />,
              label: "Asset Tagging",
            },
            {
              key: `/${BASE_PATH}/content/duplicates`,
              icon: <AppstoreOutlined />,
              label: "Duplicates",
            },
          ],
        },
      ]}
    />
  );
};
export default DionysusMenu;

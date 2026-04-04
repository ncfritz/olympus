import {
  AimOutlined,
  CalendarOutlined,
  CrownOutlined,
  ExportOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import type {
  NetworkWithContentCounts,
  BaseTvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Affix,
  Layout,
  QRCode,
  Space,
  Spin,
  Table,
  Tabs,
  type TabsProps,
  Typography,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import ReactCountryFlag from "react-country-flag/src";
import NetworkImageList from "../../../../components/dionysus/metadata/NetworkImageList";
import TvSeriesList from "../../../../components/dionysus/metadata/TvSeriesList";
import OlympusBreadcrumbs from "../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";
import metadataApi from "../../../../api/metadataApi";
import Timestamp from "../../../../components/data/Timestamp";
import { MetadataOutlinedIcon } from "../../../../icons";

const NetworkDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [network, networkLoading, networkError] = useFetch<
    number,
    NetworkWithContentCounts
  >({
    dataType: "TV network",
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.describeNetwork(o)).data.network,
  });

  const [tvSeries, tvSeriesLoading, tvSeriesError] = useFetch<
    number,
    BaseTvSeries[]
  >({
    dataType: "network TV series",
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.listTvSeriesForNetwork(o)).data.tvSeries,
  });

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );
  const items: TabsProps["items"] = [];

  if (network) {
    items.push({
      key: "t-net-tv",
      label: "TV Series",
      children: (
        <Space
          style={{ width: "100%", padding: 16 }}
          styles={{ item: { width: "100%" } }}
        >
          <TvSeriesList tvSeries={tvSeries || []} loading={tvSeriesLoading} />
        </Space>
      ),
    });

    if (network.images.length > 0) {
      items.push({
        key: "t-pc-logos",
        label: "Logos",
        children: (
          <Space
            style={{ width: "100%", padding: 16 }}
            styles={{ item: { width: "100%" } }}
          >
            <NetworkImageList
              images={network.images}
              loading={networkLoading}
            />
          </Space>
        ),
      });
    }

    if (network.alternativeNames.length > 0) {
      const namesTable = (
        <Table
          style={{ width: "100%" }}
          rowKey={"id"}
          columns={[
            {
              key: "type",
              title: "Type",
              dataIndex: "type",
              render: (value) => {
                return (
                  <Typography.Text>
                    {value || "Alternative Name"}
                  </Typography.Text>
                );
              },
              sorter: false,
              width: 200,
            },
            {
              key: "name",
              title: "Name",
              dataIndex: "name",
              render: (value) => {
                return <Typography.Text>{value}</Typography.Text>;
              },
              sorter: false,
            },
            {
              key: "createdTime",
              title: "Created",
              dataIndex: "createdTime",
              render: (value) => {
                return <Timestamp value={value} showTime={true} />;
              },
              sorter: false,
              width: 200,
            },
            {
              key: "last_updated_at",
              title: "Last Updated",
              dataIndex: "lastUpdatedTime",
              render: (value) => {
                return <Timestamp value={value} showTime={true} />;
              },
              sorter: false,
              width: 200,
            },
          ]}
          dataSource={network.alternativeNames}
          size={"small"}
          loading={networkLoading}
        />
      );

      items.push({
        key: "t-pc-altNames",
        label: "Alternative Names",
        children: namesTable,
      });
    }

    content = (
      <Space
        direction={"vertical"}
        size={4}
        style={{
          margin: 16,
          padding: 16,
          background: "#ffffffdd",
          border: "1px solid #ddddddee",
        }}
      >
        <Typography.Title level={3}>{network?.name}</Typography.Title>
        <Space
          direction={"horizontal"}
          size={32}
          style={{ justifyContent: "space-between" }}
        >
          <Space direction={"vertical"}>
            <Space direction={"horizontal"} size={4}>
              <Typography.Text strong={true}>ID:</Typography.Text>
              <Typography.Text>{network?.id}</Typography.Text>
            </Space>
            {network?.homepage && (
              <Typography.Text>
                <Space direction={"horizontal"} size={4}>
                  <HomeOutlined />
                  <Typography.Text strong={true}>Homepage:</Typography.Text>
                  <Link href={network.homepage}>
                    <Space direction={"horizontal"} size={4}>
                      <Typography.Text
                        style={{ fontSize: "inherit", color: "inherit" }}
                      >
                        {network.homepage}
                      </Typography.Text>
                      <ExportOutlined />
                    </Space>
                  </Link>
                </Space>
              </Typography.Text>
            )}
            {network?.headquarters && (
              <Space direction={"horizontal"} size={8} align={"center"}>
                <CrownOutlined />
                <Typography.Text strong={true}>Headquarters:</Typography.Text>
                <Typography.Text>{network.headquarters}</Typography.Text>
              </Space>
            )}
            {network?.originCountry && (
              <Space direction={"horizontal"} size={8} align={"center"}>
                <AimOutlined />
                <Typography.Text strong={true}>Country:</Typography.Text>
                <ReactCountryFlag
                  countryCode={network.originCountry.id}
                  cdnUrl={"/flags/"}
                  cdnSuffix={"svg"}
                  svg={true}
                />
                <Typography>{network.originCountry.name}</Typography>
              </Space>
            )}
            <Space direction={"horizontal"} size={8} align={"center"}>
              <CalendarOutlined />
              <Typography.Text strong={true}>Created:</Typography.Text>
              <Timestamp
                value={network!.createdTime}
                showTime={true}
                showIcon={false}
                direction={"horizontal"}
              />
            </Space>
            <Space direction={"horizontal"} size={8} align={"center"}>
              <CalendarOutlined />
              <Typography.Text strong={true}>Last Updated:</Typography.Text>
              <Timestamp
                value={network!.lastUpdatedTime}
                showTime={true}
                showIcon={false}
                direction={"horizontal"}
              />
            </Space>
          </Space>
          <QRCode
            bordered={false}
            value={`https://dionysus.dev.ncfritz.net/dionysus/tv/networks/${network.id}`}
          />
        </Space>
      </Space>
    );
  }

  return (
    <>
      <OlympusBreadcrumbs
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
              <Link href={"/dionysus/tv/networks"}>
                <Space size={4}>
                  <MetadataOutlinedIcon />
                  <span>TV Networks</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <MetadataOutlinedIcon />
                <span>Company</span>
              </Space>
            ),
          },
        ]}
      />
      <Space direction={"vertical"} size={0} style={{ width: "100%" }}>
        <Space
          direction={"horizontal"}
          style={{
            minHeight: 250,
            width: "100%",
            justifyContent: "space-between",
            background: "bottom left no-repeat url('/section_header.png')",
            borderBottom: "1px solid #efefef",
          }}
        >
          {content}
          {network && network.logoPath && (
            <Space direction={"vertical"} style={{ margin: 16 }}>
              <img
                src={`https://image.tmdb.org/t/p/w300/${network.logoPath}`}
                style={{ maxHeight: 250, marginRight: 32 }}
              />
            </Space>
          )}
        </Space>
      </Space>
      <Tabs
        items={items}
        className={"fill"}
        tabBarStyle={{
          marginBottom: 0,
        }}
      />
    </>
  );
};

export default NetworkDetailPage;

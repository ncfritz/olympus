import {
  AimOutlined,
  CalendarOutlined,
  ClusterOutlined,
  CrownOutlined,
  ExportOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import type {
  FullProductionCompany,
  SparseMovie,
  BaseTvSeries,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  QRCode,
  Space,
  Spin,
  Table,
  Tabs,
  type TabsProps,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import ReactCountryFlag from "react-country-flag/src";
import metadataApi from "../../../api/metadataApi";
import Timestamp from "../../../components/data/Timestamp";
import MovieList from "../../../components/dionysus/metadata/MovieList";
import ProductionCompanyLogoList from "../../../components/dionysus/metadata/ProductionCompanyLogoList";
import ProductionCompanyTable from "../../../components/dionysus/metadata/ProductionCompanyTable";
import TvSeriesList from "../../../components/dionysus/metadata/TvSeriesList";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { MetadataOutlinedIcon } from "../../../icons";
import { OLYMPUS_HOST } from "../../../utils/constants";

const ProductionCompanyDetailPage: React.FunctionComponent = () => {
  const router = useRouter();
  const { id } = router.query;

  const [productionCompany, productionCompanyLoading, productionCompanyError] =
    useFetch<number, FullProductionCompany>({
      dataType: "production company",
      watch: [id],
      params: id as unknown as number,
      fetchFunction: async (o) =>
        (await metadataApi.describeProductionCompany(o)).data.company,
    });

  const [movies, moviesLoading, moviesError] = useFetch<number, SparseMovie[]>({
    dataType: "production company movies",
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.listMoviesForProductionCompany(o)).data.movies,
  });

  const [tvSeries, tvSeriesLoading, tvSeriesError] = useFetch<
    number,
    BaseTvSeries[]
  >({
    dataType: "production company TV series",
    watch: [id],
    params: id as unknown as number,
    fetchFunction: async (o) =>
      (await metadataApi.listTvSeriesForProductionCompany(o)).data.tvSeries,
  });

  let content = (
    <Space style={{ margin: 16 }}>
      <Spin size={"large"} />
    </Space>
  );
  const items: TabsProps["items"] = [];

  if (productionCompany) {
    items.push(
      {
        key: "t-pc-movies",
        label: "Movies",
        children: (
          <Space
            style={{ width: "100%", padding: 16 }}
            styles={{ item: { width: "100%" } }}
          >
            <MovieList movies={movies || []} loading={moviesLoading} />
          </Space>
        ),
      },
      {
        key: "t-pc-tv",
        label: "TV Series",
        children: (
          <Space
            style={{ width: "100%", padding: 16 }}
            styles={{ item: { width: "100%" } }}
          >
            <TvSeriesList tvSeries={tvSeries || []} loading={tvSeriesLoading} />
          </Space>
        ),
      },
    );

    if (productionCompany.logos.length > 0) {
      items.push({
        key: "t-pc-logos",
        label: "Logos",
        children: (
          <Space style={{ width: "100%", padding: 16 }}>
            <ProductionCompanyLogoList
              logos={productionCompany.logos}
              loading={productionCompanyLoading}
            />
          </Space>
        ),
      });
    }

    if (productionCompany.alternativeNames.length > 0) {
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
          dataSource={productionCompany.alternativeNames}
          size={"small"}
          loading={productionCompanyLoading}
        />
      );

      items.push({
        key: "t-pc-altNames",
        label: "Alternative Names",
        children: namesTable,
      });
    }

    if (productionCompany?.children.length > 0) {
      items.push({
        key: "t-pc-children",
        label: "Child Companies",
        children: (
          <ProductionCompanyTable
            sticky={true}
            scrollY="calc(100vh - 481px)"
            data={productionCompany?.children || []}
            loading={productionCompanyLoading}
            error={productionCompanyError}
            pagination={undefined}
            onChange={undefined}
          />
        ),
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
        <Typography.Title level={3}>{productionCompany?.name}</Typography.Title>
        <Space
          direction={"horizontal"}
          size={32}
          style={{ justifyContent: "space-between" }}
        >
          <Space orientation={"vertical"}>
            <Space orientation={"horizontal"} size={4}>
              <Typography.Text strong={true}>ID:</Typography.Text>
              <Typography.Text>{productionCompany?.id}</Typography.Text>
            </Space>
            {productionCompany?.homepage && (
              <Typography.Text>
                <Space orientation={"horizontal"} size={4}>
                  <HomeOutlined />
                  <Typography.Text strong={true}>Homepage:</Typography.Text>
                  <Link href={productionCompany.homepage}>
                    <Space orientation={"horizontal"} size={4}>
                      <Typography.Text
                        style={{ fontSize: "inherit", color: "inherit" }}
                      >
                        {productionCompany.homepage}
                      </Typography.Text>
                      <ExportOutlined />
                    </Space>
                  </Link>
                </Space>
              </Typography.Text>
            )}
            {productionCompany?.headquarters && (
              <Space orientation={"horizontal"} size={8} align={"center"}>
                <CrownOutlined />
                <Typography.Text strong={true}>Headquarters:</Typography.Text>
                <Typography.Text>
                  {productionCompany.headquarters}
                </Typography.Text>
              </Space>
            )}
            {productionCompany?.originCountry && (
              <Space orientation={"horizontal"} size={8} align={"center"}>
                <AimOutlined />
                <Typography.Text strong={true}>Country:</Typography.Text>
                <ReactCountryFlag
                  countryCode={productionCompany.originCountry.id}
                  cdnUrl={"/flags/"}
                  cdnSuffix={"svg"}
                  svg={true}
                />
                <Typography>{productionCompany.originCountry.name}</Typography>
              </Space>
            )}
            {productionCompany?.parent && (
              <Space orientation={"horizontal"} size={8} align={"center"}>
                <ClusterOutlined />
                <Typography.Text strong={true}>Parent:</Typography.Text>
                <Link
                  href={`/dionysus/productionCompanies/${productionCompany.parent.id}`}
                >
                  <Typography>{productionCompany.parent.name}</Typography>
                </Link>
              </Space>
            )}
            <Space orientation={"horizontal"} size={8} align={"center"}>
              <CalendarOutlined />
              <Typography.Text strong={true}>Created:</Typography.Text>
              <Timestamp
                value={productionCompany!.createdTime}
                showTime={true}
                showIcon={false}
                direction={"horizontal"}
              />
            </Space>
            <Space orientation={"horizontal"} size={8} align={"center"}>
              <CalendarOutlined />
              <Typography.Text strong={true}>Last Updated:</Typography.Text>
              <Timestamp
                value={productionCompany!.lastUpdatedTime}
                showTime={true}
                showIcon={false}
                direction={"horizontal"}
              />
            </Space>
          </Space>
          <QRCode
            bordered={false}
            value={`${OLYMPUS_HOST}/dionysus/productionCompanies/${productionCompany.id}`}
          />
        </Space>
        {productionCompany?.description && (
          <Space style={{ width: "100%", marginTop: 16 }}>
            {productionCompany?.description}
          </Space>
        )}
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
              <Link href={"/dionysus/productionCompanies"}>
                <Space size={4}>
                  <MetadataOutlinedIcon />
                  <span>Production Companies</span>
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
      <Space orientation={"vertical"} size={0} style={{ width: "100%" }}>
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
          {productionCompany && productionCompany.logoPath && (
            <Space orientation={"vertical"} style={{ margin: 16 }}>
              <img
                src={`https://image.tmdb.org/t/p/w300/${productionCompany.logoPath}`}
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

export default ProductionCompanyDetailPage;

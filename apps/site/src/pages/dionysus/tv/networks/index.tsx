import { HomeOutlined } from "@ant-design/icons";
import { Affix, Layout, Space, type TableProps } from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { useState } from "react";
import type { PaginatedParams, SortOptions } from "../../../../api/common";
import metadataApi from "../../../../api/metadataApi";
import NetworksTable from "../../../../components/dionysus/metadata/NetworksTable";
import OlympusBreadcrumbs from "../../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../../icons";
import type {
  ListNetworksResponse,
  Certification,
} from "@ncfritz/olympus-sdk/dionysus";

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const NetworksIndexPage: React.FunctionComponent = () => {
  const [networksPage, setNetworksPage] = useState(0);
  const [networksSort, setNetworksSort] = useState<SortOptions>({
    field: "id",
    order: "asc",
  });

  const [networks, networksLoading, networksError] = useFetch<
    PaginatedParams,
    ListNetworksResponse
  >({
    dataType: "TV networks",
    default: { networks: [], count: 0 },
    watch: [networksPage, networksSort],
    fetchFunction: async (o) =>
      (await metadataApi.listNetworks(o.page, o.sort)).data,
    params: {
      page: networksPage,
      sort: networksSort,
    },
  });

  return (
    <>
      <Affix offsetTop={64}>
        <OlympusBreadcrumbs
          items={[
            {
              title: (
                <Link href={"/public"}>
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
                <Space>
                  <CertificationOutlined />
                  <span>TV Networks</span>
                </Space>
              ),
            },
          ]}
        />
      </Affix>
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 92,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 92px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 384px)" }}>
          <NetworksTable
            data={networks.networks}
            loading={networksLoading}
            sticky={true}
            scrollY="calc(100vh - 187px)"
            pagination={{
              style: {
                marginLeft: 16,
              },
              pageSize: 20,
              size: "small",
              total: networks.count,
              showSizeChanger: false,
              showQuickJumper: true,
              showTotal: (total, range) => {
                return `${range[0]} to ${range[1]} of ${total}`;
              },
            }}
            onChange={(pagination, filters, sorter, extra) => {
              const s = sorter as Sorts;

              switch (extra.action) {
                case "paginate":
                  setNetworksPage(pagination.current! - 1);
                  break;
                case "sort":
                  setNetworksSort({
                    field: s.columnKey?.toString() || "",
                    order: s.order === "ascend" ? "asc" : "desc",
                  });
                  break;
                case "filter":
                  break;
              }
            }}
          />
        </Content>
      </Layout>
    </>
  );
};

export default NetworksIndexPage;

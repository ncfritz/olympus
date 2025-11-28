import { HomeOutlined } from "@ant-design/icons";
import {
  Affix,
  Breadcrumb,
  Layout,
  notification,
  Space,
  type TableProps,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import Link from "next/link";
import React, { type ReactNode, useEffect, useState } from "react";
import type { SortOptions } from "../../../api/common";
import metadataApi from "../../../api/metadataApi";
import ProductionCompanyTable from "../../../components/dionysus/metadata/ProductionCompanyTable";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";
import type { NotificationType } from "../../../utils/notifications";
import type {
  SparseProductionCompanyWithContentCounts,
  Certification,
} from "@ncfritz/olympus-sdk/dionysus";

type OnChange = NonNullable<TableProps<Certification>["onChange"]>;
type GetSingle<T> = T extends (infer U)[] ? U : never;
type Sorts = GetSingle<Parameters<OnChange>[2]>;

const ProductionCompaniesIndexPage: React.FunctionComponent = () => {
  const [api, contextHolder] = notification.useNotification();

  const [productionCompanies, setProductionCompanies] = useState<
    SparseProductionCompanyWithContentCounts[]
  >([]);
  const [productionCompaniesLoading, setProductionCompaniesLoading] =
    useState<any>(true);
  const [productionCompaniesError, setProductionCompaniesError] =
    useState<any>();
  const [productionCompaniesCount, setProductionCompaniesCount] = useState(0);
  const [productionCompaniesPage, setProductionCompaniesPage] = useState(0);
  const [productionCompaniesSort, setProductionCompaniesSort] =
    useState<SortOptions>({
      field: "id",
      order: "asc",
    });

  const openNotificationWithIcon = (
    type: NotificationType,
    message: string,
    content: ReactNode,
  ) => {
    api[type]({
      message: message,
      description: content,
    });
  };

  const fetchProductionCompanies = async (quiet = false) => {
    if (!quiet) {
      setProductionCompaniesLoading(true);
    }
    setProductionCompaniesError(undefined);

    try {
      const listProductionCompaniesResponse =
        await metadataApi.listProductionCompanies(
          productionCompaniesPage,
          productionCompaniesSort,
        );
      setProductionCompanies(listProductionCompaniesResponse.data.companies);
      setProductionCompaniesCount(listProductionCompaniesResponse.data.count);
    } catch (e) {
      setProductionCompaniesError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load production companies list",
        "Poop",
      );
    } finally {
      setProductionCompaniesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchProductionCompanies();
    })();
  }, [productionCompaniesPage, productionCompaniesSort]);

  return (
    <>
      <Affix offsetTop={64}>
        <Breadcrumb
          style={{ padding: 8, background: "#f6f6f6" }}
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
                  <span>Production Companies</span>
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
          top: 102,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 102px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 384px)" }}>
          <ProductionCompanyTable
            data={productionCompanies}
            loading={productionCompaniesLoading}
            pagination={{
              style: {
                marginLeft: 16,
              },
              pageSize: 20,
              size: "small",
              total: productionCompaniesCount,
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
                  setProductionCompaniesPage(pagination.current! - 1);
                  break;
                case "sort":
                  setProductionCompaniesSort({
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

export default ProductionCompaniesIndexPage;

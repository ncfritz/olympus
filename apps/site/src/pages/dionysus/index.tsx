import { HomeOutlined } from "@ant-design/icons";
import type { GetMetadataFetchJobStatusStatisticsResponse } from "@ncfritz/olympus-sdk/dionysus";
import { Layout, Space } from "antd";
import Link from "next/link";
import metadataApi from "../../api/metadataApi";
import LoadingWrapper from "../../components/common/LoadingWrapper";
import MetadataStatusTable from "../../components/dionysus/metadata/MetadataStatusTable";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../hooks/useFetch";
import { CertificationOutlined } from "../../icons";

const IndexPage: React.FunctionComponent = () => {
  const [jobStats, jobStatsLoading, jobStatsError, fetchStatistics] = useFetch<
    undefined,
    GetMetadataFetchJobStatusStatisticsResponse
  >({
    dataType: "batch job statistics",
    watch: [],
    params: undefined,
    fetchFunction: async () => (await metadataApi.fetchJobStatistics()).data,
  });

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
              <Space>
                <CertificationOutlined />
                <span>Dionysus</span>
              </Space>
            ),
          },
        ]}
      />
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 92 - 32,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 92px)",
        }}
      >
        <LoadingWrapper loading={jobStatsLoading} error={jobStatsError}>
          <MetadataStatusTable statistics={jobStats} fontSize={"11px"} />
        </LoadingWrapper>
      </Layout>
    </>
  );
};

export default IndexPage;

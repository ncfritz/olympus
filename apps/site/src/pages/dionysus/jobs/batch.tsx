import { HomeOutlined } from "@ant-design/icons";
import { Col, Drawer, Row, Space, Spin, Tabs, type TabsProps } from "antd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import batchJobApi from "../../../api/batchJobApi";
import BatchJobDetailsPanel from "../../../components/dionysus/jobs/BatchJobDetailsPanel";
import BatchJobQueueTimeChart from "../../../components/dionysus/jobs/graphs/BatchJobQueueTimeChart";
import BatchJobRuntimeChart from "../../../components/dionysus/jobs/graphs/BatchJobRuntimeChart";
import BatchJobStatusChart from "../../../components/dionysus/jobs/graphs/BatchJobStatusChart";
import BatchJobPanel from "../../../components/layout/jobs/BatchJobPanel";
import OlympusBreadcrumbs from "../../../components/layout/OlympusBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";
import type {
  BatchJob,
  GetBatchJobStatsResponse,
} from "@ncfritz/olympus-sdk/dionysus";

const BatchJobsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const query = useSearchParams();

  const [selectedJob, setSelectedJob] = useState<BatchJob | undefined>(
    undefined,
  );
  const [activeTab, setActiveTab] = useState(query.get("tab") || "movies");

  const [jobStats, jobStatsLoading, , fetchStatistics] = useFetch<
    undefined,
    GetBatchJobStatsResponse
  >({
    dataType: "batch job statistics",
    watch: [],
    params: undefined,
    fetchFunction: async () => (await batchJobApi.getBatchJobStats()).data,
  });

  useEffect(() => {
    (async () => {
      await fetchStatistics(false);
    })();
  }, []);

  const closeDrawer = () => {
    setSelectedJob(undefined);
  };

  const items: TabsProps["items"] = [
    {
      key: "t-bj-movies",
      label: "Movies",
      children: <BatchJobPanel type={"movies"} onSelect={setSelectedJob} />,
    },
    {
      key: "t-bj-tv-series",
      label: "TV Series",
      children: <BatchJobPanel type={"tv_series"} onSelect={setSelectedJob} />,
    },
    {
      key: "t-bj-people",
      label: "People",
      children: <BatchJobPanel type={"people"} onSelect={setSelectedJob} />,
    },
    {
      key: "t-bj-collections",
      label: "Collections",
      children: (
        <BatchJobPanel type={"collections"} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-tv-networks",
      label: "TV Networks",
      children: (
        <BatchJobPanel type={"tv_networks"} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-keywords",
      label: "Keywords",
      children: <BatchJobPanel type={"keywords"} onSelect={setSelectedJob} />,
    },
    {
      key: "t-bj-production-companies",
      label: "Production Companies",
      children: (
        <BatchJobPanel
          type={"production_companies"}
          onSelect={setSelectedJob}
        />
      ),
    },
    {
      key: "t-bj-genres",
      label: "Genres",
      children: <BatchJobPanel type={"genres"} onSelect={setSelectedJob} />,
    },
    {
      key: "t-bj-certifications",
      label: "Certifications",
      children: (
        <BatchJobPanel type={"certifications"} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-countries",
      label: "Countries",
      children: <BatchJobPanel type={"countries"} onSelect={setSelectedJob} />,
    },
    {
      key: "t-bj-languages",
      label: "Languages",
      children: <BatchJobPanel type={"languages"} onSelect={setSelectedJob} />,
    },
    {
      key: "t-bj-redrive",
      label: "Redrive Jobs",
      children: (
        <BatchJobPanel
          type={"redrive"}
          onSelect={setSelectedJob}
          showPublish={false}
        />
      ),
    },
  ];

  let queueTimeChart = (
    <Space>
      <Spin />
    </Space>
  );

  let runtimeChart = (
    <Space>
      <Spin />
    </Space>
  );

  let statusChart = (
    <Space>
      <Spin />
    </Space>
  );

  if (jobStats && !jobStatsLoading) {
    queueTimeChart = <BatchJobQueueTimeChart stats={jobStats} />;
    runtimeChart = <BatchJobRuntimeChart stats={jobStats} />;
    statusChart = <BatchJobStatusChart stats={jobStats} />;
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
              <Space size={4}>
                <MetadataOutlinedIcon />
                <span>Metadata</span>
              </Space>
            ),
          },
          {
            title: (
              <Space>
                <CertificationOutlined />
                <span>Batch Jobs</span>
              </Space>
            ),
          },
        ]}
      />
      <Row gutter={16} style={{ marginBottom: 36 }}>
        <Col span={8}>{statusChart}</Col>
        <Col span={8}>{queueTimeChart}</Col>
        <Col span={8}>{runtimeChart}</Col>
      </Row>
      <Tabs
        className={"fill"}
        activeKey={`t-bj-${activeTab}`}
        items={items}
        onSelect={() => {
          closeDrawer();
        }}
        onChange={(tab) => {
          const activeTabName = tab.substring("t-bj-".length);
          setActiveTab(activeTabName);
          router.push(
            `${router.pathname}?tab=${activeTabName}`,
            `${router.pathname}?tab=${activeTabName}`,
            { shallow: true },
          );
        }}
        tabBarStyle={{
          marginBottom: 0,
        }}
      />
      <Drawer
        title="Batch Job Details"
        size={550}
        placement="right"
        onClose={() => {
          closeDrawer();
        }}
        open={selectedJob !== undefined}
      >
        <BatchJobDetailsPanel job={selectedJob!} close={closeDrawer} />
      </Drawer>
    </>
  );
};

export default BatchJobsPage;

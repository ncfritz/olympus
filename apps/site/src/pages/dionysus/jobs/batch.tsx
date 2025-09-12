import { HomeOutlined } from "@ant-design/icons";
import {
  Affix,
  Breadcrumb,
  Col,
  Drawer,
  Layout,
  Row,
  Space,
  Spin,
  Tabs,
  type TabsProps,
} from "antd";
import { Content } from "antd/lib/layout/layout";
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
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";
import { type BatchJobRecord, JobType } from "../../../types/dionysus";

const BatchJobsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const query = useSearchParams();

  const [selectedJob, setSelectedJob] = useState<BatchJobRecord | undefined>(
    undefined,
  );
  const [jobStats, setJobStats] = useState<any>();
  const [jobStatsLoading, setJobStatsLoading] = useState<any>(true);
  const [jobStatsError, setJobStatsError] = useState<any>();
  const [activeTab, setActiveTab] = useState(query.get("tab") || "movies");

  const fetchStatistics = async () => {
    setJobStatsLoading(true);
    setJobStatsError(undefined);

    try {
      const getJobsStatsResponse = await batchJobApi.getBatchJobStats();
      setJobStats(getJobsStatsResponse.data);
    } catch (e) {
      setJobStatsError(e);
    } finally {
      setJobStatsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchStatistics();
    })();
  }, []);

  const closeDrawer = () => {
    setSelectedJob(undefined);
  };

  const items: TabsProps["items"] = [
    {
      key: "t-bj-movies",
      label: "Movies",
      children: (
        <BatchJobPanel type={JobType.MOVIES} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-tv-series",
      label: "TV Series",
      children: (
        <BatchJobPanel type={JobType.TV_SERIES} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-people",
      label: "People",
      children: (
        <BatchJobPanel type={JobType.PEOPLE} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-collections",
      label: "Collections",
      children: (
        <BatchJobPanel type={JobType.COLLECTIONS} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-tv-networks",
      label: "TV Networks",
      children: (
        <BatchJobPanel type={JobType.TV_NETWORKS} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-keywords",
      label: "Keywords",
      children: (
        <BatchJobPanel type={JobType.KEYWORDS} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-production-companies",
      label: "Production Companies",
      children: (
        <BatchJobPanel
          type={JobType.PRODUCTION_COMPANIES}
          onSelect={setSelectedJob}
        />
      ),
    },
    {
      key: "t-bj-genres",
      label: "Genres",
      children: (
        <BatchJobPanel type={JobType.GENRES} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-certifications",
      label: "Certifications",
      children: (
        <BatchJobPanel
          type={JobType.CERTIFICATIONS}
          onSelect={setSelectedJob}
        />
      ),
    },
    {
      key: "t-bj-countries",
      label: "Countries",
      children: (
        <BatchJobPanel type={JobType.COUNTRIES} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-languages",
      label: "Languages",
      children: (
        <BatchJobPanel type={JobType.LANGUAGES} onSelect={setSelectedJob} />
      ),
    },
    {
      key: "t-bj-redrive",
      label: "Redrive Jobs",
      children: (
        <BatchJobPanel
          type={JobType.REDRIVE}
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

  if (!jobStatsLoading) {
    queueTimeChart = <BatchJobQueueTimeChart stats={jobStats} />;
    runtimeChart = <BatchJobRuntimeChart stats={jobStats} />;
    statusChart = <BatchJobStatusChart stats={jobStats} />;
  }

  return (
    <>
      <Affix offsetTop={64}>
        <Breadcrumb
          style={{ padding: 8, background: "#f6f6f6" }}
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
            width={550}
            placement="right"
            onClose={() => {
              closeDrawer();
            }}
            open={selectedJob !== undefined}
          >
            <BatchJobDetailsPanel
              job={selectedJob!}
              close={closeDrawer}
              postUpdate={async () => {}}
            />
          </Drawer>
        </Content>
      </Layout>
    </>
  );
};

export default BatchJobsPage;

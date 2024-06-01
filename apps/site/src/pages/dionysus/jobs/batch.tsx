import { HomeOutlined } from "@ant-design/icons";
import {
  Affix,
  Breadcrumb,
  Col,
  Drawer,
  Row,
  Space,
  Spin,
  Tabs,
  type TabsProps,
} from "antd";
import { Content } from "antd/lib/layout/layout";
import axios from "axios";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import BatchJobDetailsPanel from "../../../components/dionysus/jobs/BatchJobDetailsPanel";
import BatchJobPanel, {
  type BatchJobRecord,
  JobType,
} from "../../../components/layout/jobs/BatchJobPanel";
import { CertificationOutlined, MetadataOutlinedIcon } from "../../../icons";

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
      const getJobsStatsResponse = await axios.get(`/api/v1/jobs/batch/stats`);
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
      key: "t-bj-all",
      label: "All",
      children: <BatchJobPanel type={JobType.ALL} onSelect={setSelectedJob} />,
    },
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
    queueTimeChart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          chart: {
            height: 250,
          },
          tooltip: {
            shared: true,
          },
          plotOptions: {
            spline: {
              marker: {
                symbol: "square",
                radius: 2,
              },
              lineWidth: 1,
            },
          },
          title: {
            text: "Queue Latency",
            style: { fontSize: 10 },
          },
          xAxis: {
            type: "datetime",
            labels: {
              format: "{value:%m-%d}",
            },
          },
          yAxis: {
            title: {
              text: "ms",
            },
            type: "logarithmic",
          },
          legend: {
            align: "left",
          },
          series: [
            {
              type: "spline",
              name: "Movies",
              data: jobStats.series.timing.queueTime.movies,
              color: "#003f5c",
            },
            {
              type: "spline",
              name: "TV Series",
              data: jobStats.series.timing.queueTime.tv_series,
              color: "#bc5090",
            },
            {
              type: "spline",
              name: "People",
              data: jobStats.series.timing.queueTime.people,
              color: "#7a5195",
            },
            {
              type: "spline",
              name: "Collections",
              data: jobStats.series.timing.queueTime.collections,
              color: "#bc5090",
            },
            {
              type: "spline",
              name: "TV Networks",
              data: jobStats.series.timing.queueTime.tv_networks,
              color: "#ef5675",
            },
            {
              type: "spline",
              name: "Keywords",
              data: jobStats.series.timing.queueTime.keywords,
              color: "#ff764a",
            },
            {
              type: "spline",
              name: "Production Companies",
              data: jobStats.series.timing.queueTime.production_companies,
              color: "#ffa600",
            },
          ],
          credits: {
            enabled: false,
          },
        }}
      />
    );

    runtimeChart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          chart: {
            height: 250,
          },
          tooltip: {
            shared: true,
          },
          plotOptions: {
            spline: {
              marker: {
                symbol: "square",
                radius: 2,
              },
              lineWidth: 1,
            },
          },
          title: {
            text: "Runtime",
            style: { fontSize: 10 },
          },
          xAxis: {
            type: "datetime",
            labels: {
              format: "{value:%m-%d}",
            },
          },
          yAxis: {
            title: {
              text: "ms",
            },
            type: "logarithmic",
          },
          legend: {
            align: "left",
          },
          series: [
            {
              type: "spline",
              name: "Movies",
              data: jobStats.series.timing.runtime.movies,
              color: "#003f5c",
            },
            {
              type: "spline",
              name: "TV Series",
              data: jobStats.series.timing.runtime.tv_series,
              color: "#bc5090",
            },
            {
              type: "spline",
              name: "People",
              data: jobStats.series.timing.runtime.people,
              color: "#7a5195",
            },
            {
              type: "spline",
              name: "Collections",
              data: jobStats.series.timing.runtime.collections,
              color: "#bc5090",
            },
            {
              type: "spline",
              name: "TV Networks",
              data: jobStats.series.timing.runtime.tv_networks,
              color: "#ef5675",
            },
            {
              type: "spline",
              name: "Keywords",
              data: jobStats.series.timing.runtime.keywords,
              color: "#ff764a",
            },
            {
              type: "spline",
              name: "Production Companies",
              data: jobStats.series.timing.runtime.production_companies,
              color: "#ffa600",
            },
          ],
          credits: {
            enabled: false,
          },
        }}
      />
    );

    statusChart = (
      <HighchartsReact
        highcharts={Highcharts}
        options={{
          width: "100%",
          chart: {
            height: 250,
            type: "column",
          },
          tooltip: {
            shared: true,
          },
          plotOptions: {
            series: {
              stacking: "normal",
            },
            column: {
              pointWidth: 15,
            },
          },
          title: {
            text: "Job Statuses",
            style: { fontSize: 10 },
          },
          xAxis: {
            categories: jobStats.categories.status,
          },
          legend: {
            layout: "vertical",
            align: "right",
            verticalAlign: "top",
          },
          series: [
            {
              name: "Cancelled",
              data: jobStats.series.status.cancelled,
              color: "#ffa600",
            },
            {
              name: "Failed",
              data: jobStats.series.status.failed,
              color: "#ff6361",
            },
            {
              name: "Success",
              data: jobStats.series.status.success,
              color: "#bc5090",
            },
            {
              name: "Started",
              data: jobStats.series.status.started,
              color: "#58508d",
            },
            {
              name: "Created",
              data: jobStats.series.status.created,
              color: "#003f5c",
            },
          ],
          credits: {
            enabled: false,
          },
        }}
      />
    );
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
      <Content
        style={{
          background: "#fff",
          marginTop: 16,
        }}
      >
        <Content
          style={{
            marginBottom: 16,
          }}
        >
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
      </Content>
    </>
  );
};

export default BatchJobsPage;

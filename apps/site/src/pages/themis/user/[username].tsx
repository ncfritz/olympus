import {
  HomeOutlined,
  PlusOutlined,
  RadarChartOutlined,
  UsergroupAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  Input,
  Layout,
  Result,
  Space,
  Spin,
  Tabs,
} from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import { PUBLISH_EVENT } from "../../../components/common/NotificationSink";
import BasicUserInfoPanel from "../../../components/themis/data/BasicUserInfoPanel";
import DataSummaryPanel from "../../../components/themis/data/DataSummaryPanel";
import UserDataTabGroup from "../../../components/themis/data/UserDataTabGroup";
import { publish } from "../../../utils/events";
import type { DataSummaryResponse } from "../../api/themis/user/[username]/data/dataSummary";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();
  const params = useParams<{ username: string }>();

  const [dataYears, setDataYears] = useState<string[]>([]);
  const [dataYearsLoading, setDataYearsLoading] = useState(false);
  const [dataYearsError, setDataYearsError] = useState(false);
  const [dataSummary, setDataSummary] = useState<
    DataSummaryResponse | undefined
  >(undefined);
  const [dataSummaryLoading, setDataSummaryLoading] = useState(false);
  const [dataSummaryError, setDataSummaryError] = useState(false);
  const [newYear, setNewYear] = useState<string | undefined>(undefined);

  const loadDataYears = async (quiet: boolean = false) => {
    if (!quiet) {
      setDataYearsLoading(true);
    }

    setDataYearsError(false);

    try {
      const response = await themisApi.listDataYears(params.username);
      setDataYears(response.years);
    } catch (e) {
      setDataYearsError(true);
    } finally {
      setDataYearsLoading(false);
    }
  };

  const loadDataSummary = async (quiet: boolean = false) => {
    if (!quiet) {
      setDataSummaryLoading(true);
    }

    setDataYearsError(false);

    try {
      const response = await themisApi.getDataSummary(params.username);
      setDataSummary(response);
    } catch (e) {
      setDataSummaryError(true);
    } finally {
      setDataSummaryLoading(false);
    }
  };

  const addDataYear = async () => {
    try {
      await themisApi.createDataYear(params.username, newYear!.trim());
      await loadDataYears(true);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Data year added",
        description: `Year ${newYear} has been created and is ready for use`,
      });

      setNewYear(undefined);
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to create data year",
        description: "Unable to create new data year due to a server error",
      });
    }
  };

  useEffect(() => {
    (async () => {
      await loadDataYears();
      await loadDataSummary();
    })();
  }, []);

  const tabActions = (
    <Space.Compact>
      <Input
        size={"small"}
        style={{ width: 75 }}
        allowClear={true}
        value={newYear}
        onChange={(e) => {
          setNewYear(e.target.value);
        }}
      />
      <Button
        type={"primary"}
        size={"small"}
        icon={<PlusOutlined />}
        disabled={newYear === undefined || newYear.trim() === ""}
        onClick={async () => {
          await addDataYear();
        }}
      />
    </Space.Compact>
  );

  let content;

  if (dataYearsLoading) {
    content = (
      <Space
        style={{
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin size={"small"} />
      </Space>
    );
  } else if (dataYearsError) {
    content = (
      <Result
        status={"error"}
        subTitle={
          "Unable to retrieve review years, please verify the user exists"
        }
      />
    );
  } else if (dataYears.length <= 0) {
    content = (
      <Tabs
        items={[
          {
            key: "no-years",
            label: "No data years",
            disabled: true,
            children: <Empty />,
          },
        ]}
        tabBarExtraContent={tabActions}
      />
    );
  } else {
    const tabs: any[] = [
      {
        key: `datayear-summary`,
        label: "Data Summary",
        children: (
          <DataSummaryPanel
            summary={dataSummary}
            loading={dataSummaryLoading}
            error={dataSummaryError}
          />
        ),
      },
    ];

    dataYears.forEach((year) => {
      tabs.push({
        key: `datayear-${year}`,
        label: year,
        children: <UserDataTabGroup username={params.username} year={year} />,
      });
    });

    content = <Tabs items={tabs} tabBarExtraContent={tabActions} />;
  }

  return (
    <>
      <Breadcrumb
        style={{
          padding: 8,
          background: "#f6f6f6",
          position: "fixed",
          zIndex: 1000,
          width: "100%",
        }}
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
              <Link href={"/themis"}>
                <Space size={4}>
                  <RadarChartOutlined />
                  <span>Themis</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Link href={"/themis/users"}>
                <Space size={4}>
                  <UsergroupAddOutlined />
                  <span>Users</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <UserOutlined />
                <span>{router.query.username}</span>
              </Space>
            ),
          },
        ]}
      />
      <Content
        style={{
          paddingTop: 41,
          background: "#fff",
        }}
      >
        <Content
          style={{
            marginTop: 0,
            marginBottom: 16,
            padding: 8,
          }}
        >
          <Space direction={"vertical"} size={16} style={{ width: "100%" }}>
            <BasicUserInfoPanel username={params.username} />
            <Card title={"Data"} size={"small"} bordered={true}>
              {content}
            </Card>
          </Space>
        </Content>
      </Content>
    </>
  );
};

export default IndexPage;

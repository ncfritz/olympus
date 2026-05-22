import { ReloadOutlined } from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  MediaAssetSearchExecution,
} from "@ncfritz/olympus-sdk/dionysus";
import { Button, Col, Collapse, Empty, Row, Space, Typography } from "antd";
import { DateTime } from "luxon";
import type { ItemType } from "rc-collapse/es/interface";
import React, { useEffect, useState } from "react";
import mediaApi from "../../../api/mediaApi";
import { useFetch } from "../../../hooks/useFetch";
import { subscribe, unsubscribe } from "../../../utils/events";
import Description from "../../common/Description";
import LoadingWrapper from "../../common/LoadingWrapper";
import RefreshTimer from "../../common/RefreshTimer";
import Timestamp from "../../data/Timestamp";
import SearchExecutionsStatusChart from "./graphs/SearchExecutionsStatusChart";
import { getMediaAssetSearchExecutionStatusIndicator } from "./utils";

export interface SearchConfigurationPanelProps {
  searchConfiguration: MediaAssetSearchConfiguration;
}

const SearchConfigurationPanel: React.FunctionComponent<
  SearchConfigurationPanelProps
> = ({ searchConfiguration }: SearchConfigurationPanelProps) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const [executions, executionsLoading, executionsError, fetchExecutions] =
    useFetch<
      MediaAssetSearchConfiguration,
      MediaAssetSearchExecution[] | undefined
    >({
      dataType: "search executions",
      default: undefined,
      watch: [searchConfiguration],
      params: searchConfiguration,
      validateOptions: (o) => o !== undefined,
      fetchFunction: async (o) => {
        return (
          await mediaApi.listMediaAssetSearchExecutions(o.type, o.mediaId)
        ).data.searchExecutions;
      },
    });

  useEffect(() => {
    subscribe("dionysus:search:complete", onSearchComplete);

    return () => {
      unsubscribe("dionysus:search:complete", onSearchComplete);
    };
  }, []);

  const onSearchComplete = async (e: CustomEvent) => {
    if (
      `${e.detail?.assetType}` === `${searchConfiguration.type}` &&
      `${e.detail?.mediaId}` === `${searchConfiguration.mediaId}`
    ) {
      await fetchExecutions(true);
    }
  };

  const updateActivePanels = (keys: string[]) => {
    setActiveKeys(keys);
  };

  let content = <Empty description={"No Search Executions Found"} />;
  const stats: {
    new: number[];
    duplicate: number[];
    skipped: number[];
    timing: (number | null)[];
  } = {
    new: new Array<number>(30).fill(0),
    duplicate: new Array<number>(30).fill(0),
    skipped: new Array<number>(30).fill(0),
    timing: new Array<number | null>(30).fill(null),
  };

  if (executions && executions.length > 0) {
    const executionItems: ItemType[] = [];

    executions?.forEach((item, index) => {
      const startTIme = DateTime.fromISO(item.startedTime);
      const endTime = item.finishedTime
        ? DateTime.fromISO(item.finishedTime)
        : undefined;

      stats.timing[29 - index] =
        startTIme && endTime
          ? Math.abs(startTIme.diff(endTime).milliseconds)
          : 0;

      stats.new[29 - index] = item.newRecords;
      stats.duplicate[29 - index] = item.duplicateRecords;
      stats.skipped[29 - index] = item.skippedRecords;

      executionItems.push({
        style: { width: "100%" },
        label: (
          <Space
            direction={"vertical"}
            style={{ width: "100%", marginBottom: 4 }}
            styles={{ item: { lineHeight: "12px" } }}
            size={0}
          >
            <Space
              direction={"horizontal"}
              style={{ width: "100%", justifyContent: "space-between" }}
            >
              <Typography.Text style={{ fontSize: "12px" }}>
                {startTIme.toFormat("LL/dd/yyyy hh:mm:ss a")}
              </Typography.Text>
              {getMediaAssetSearchExecutionStatusIndicator(item.status)}
            </Space>
          </Space>
        ),
        children: (
          <Space
            direction={"vertical"}
            style={{
              width: "100%",
              marginLeft: 28,
              marginTop: 0,
              marginBottom: 16,
              paddingLeft: 16,
              borderLeft: "4px solid #ededed",
            }}
          >
            <Typography.Text style={{ fontSize: "10px", color: "#666666" }}>
              {item.id}
            </Typography.Text>
            <Row>
              <Col span={12}>
                <Description
                  title={"Created Time"}
                  value={
                    <Timestamp
                      value={item.createdTime}
                      showTime={true}
                      direction={"horizontal"}
                    />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={12}>
                <Description
                  title={"Last Updated Time"}
                  value={
                    <Timestamp
                      value={item.lastUpdatedTime}
                      showTime={true}
                      direction={"horizontal"}
                    />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <Description
                  title={"Started Time"}
                  value={
                    <Timestamp
                      value={item.startedTime}
                      showTime={true}
                      direction={"horizontal"}
                    />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={12}>
                <Description
                  title={"Finished Time"}
                  value={
                    <Timestamp
                      value={item.finishedTime}
                      showTime={true}
                      direction={"horizontal"}
                    />
                  }
                  valueStyle={{ fontSize: "inherit" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <Description
                  title={"Total Records"}
                  value={item.totalRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={12}>
                <Description
                  title={"New Records"}
                  value={item.newRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <Description
                  title={"Duplicate Records"}
                  value={item.duplicateRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
              <Col span={12}>
                <Description
                  title={"Skipped Records"}
                  value={item.skippedRecords?.toLocaleString()}
                  valueStyle={{ fontFamily: "monospace" }}
                  titleColor={"#666666"}
                  titleFontSize={"13px"}
                />
              </Col>
            </Row>
          </Space>
        ),
      });

      content = (
        <Collapse
          ghost={true}
          size={"small"}
          activeKey={activeKeys}
          onChange={updateActivePanels}
          items={executionItems}
        />
      );
    });
  }

  return (
    <Space direction={"vertical"} style={{ width: "100%" }}>
      <Space
        direction={"horizontal"}
        style={{
          width: "100%",
          justifyContent: "space-between",
          padding: 16,
          alignItems: "center",
        }}
      >
        <Typography.Title level={5} style={{ marginBottom: 0 }}>
          Search Executions:
        </Typography.Title>
        <Button
          size={"small"}
          type={"text"}
          icon={<ReloadOutlined />}
          onClick={async () => {
            await fetchExecutions(false);
          }}
        />
      </Space>
      <SearchExecutionsStatusChart stats={stats} />
      <RefreshTimer
        ttlMs={180000}
        fetchFunction={async () => {
          await fetchExecutions(true);
        }}
      />
      <LoadingWrapper
        loading={executionsLoading}
        error={executionsError}
        style={{ padding: 8 }}
      >
        {content}
      </LoadingWrapper>
    </Space>
  );
};
export default SearchConfigurationPanel;

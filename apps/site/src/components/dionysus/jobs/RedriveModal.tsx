import type {
  MetadataFetchJobStatus,
  MetadataJobType,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Button,
  Col,
  Modal,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Typography,
} from "antd";
import { type CSSProperties, useState } from "react";
import batchJobApi from "../../../api/batchJobApi";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import MetadataJobStatusSelect from "./MetadataJobStatusSelect";
import { getMetadataJobStatusIndicator } from "./utils";

export interface RedriveModalProps {
  open: boolean;
  onClose: () => void;
  statistics: any;
}

const StatisticStyle: CSSProperties = {
  fontFamily: "monospace",
  fontSize: "12px",
};

const RedriveModal: React.FunctionComponent<RedriveModalProps> = ({
  open,
  onClose,
  statistics,
}: RedriveModalProps) => {
  const [queryJobType, setQueryJobType] = useState<MetadataJobType | undefined>(
    undefined,
  );
  const [queryStatus, setQueryStatus] = useState<
    MetadataFetchJobStatus | undefined
  >(undefined);
  const [targetJobStatus, setTargetJobStatus] = useState<
    MetadataFetchJobStatus | undefined
  >(undefined);
  const [republish, setRepublish] = useState<boolean>(false);
  const [step, setStep] = useState<number>(0);

  const handleSetSearchCriteria = (
    type?: MetadataJobType,
    status?: MetadataFetchJobStatus,
  ) => {
    if (type) {
      setQueryJobType(type);
    }

    if (status) {
      setQueryStatus(status);
    }

    setStep(type && status ? 1 : 0);
  };

  const creatRedrive = async () => {
    try {
      await batchJobApi.createBatchRedriveJob(
        queryJobType!,
        queryStatus!,
        targetJobStatus!,
        republish,
      );

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Re-drive created",
        description: "The re-drive job was created successfully",
      });

      closeModal();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Unable to create re-drive",
        description: "The API call to /v1/jobs/batch/redrive failed",
      });
    }
  };

  const closeModal = () => {
    setStep(0);
    setQueryJobType(undefined);
    setQueryStatus(undefined);
    setTargetJobStatus(undefined);
    setRepublish(false);

    onClose();
  };

  return (
    <Modal
      title={"Create Metadata Fetch Job Re-Drive"}
      onCancel={closeModal}
      open={open}
      width={1200}
      footer={() => {
        return (
          <Space
            size={8}
            direction={"horizontal"}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Button type={"primary"} danger={true} onClick={closeModal}>
              Cancel
            </Button>
            <Space size={8} direction={"horizontal"}>
              <Button
                type={"primary"}
                disabled={!(queryStatus && queryJobType && targetJobStatus)}
                onClick={async () => {
                  await creatRedrive();
                }}
              >
                Submit Re-drive
              </Button>
            </Space>
          </Space>
        );
      }}
    >
      {statistics && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  verticalAlign: "bottom",
                  textAlign: "left",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                Job Type
              </th>
              <th>{getMetadataJobStatusIndicator("fetched", true)}</th>
              <th>{getMetadataJobStatusIndicator("fetching", true)}</th>
              <th>{getMetadataJobStatusIndicator("invalidated", true)}</th>
              <th>{getMetadataJobStatusIndicator("failed", true)}</th>
              <th>{getMetadataJobStatusIndicator("not_found", true)}</th>
              <th>{getMetadataJobStatusIndicator("cancelled", true)}</th>
              <th>{getMetadataJobStatusIndicator("queued", true)}</th>
            </tr>
          </thead>
          <tbody>
            {statistics.status.categories.map((item: string, index: number) => {
              return (
                <tr className={"table-row-hover"}>
                  <td>{item}</td>
                  <td
                    className={"table-cell-hover"}
                    onClick={() => {
                      handleSetSearchCriteria(
                        statistics.expiration.series[index].name,
                        "fetched",
                      );
                    }}
                  >
                    <Typography.Text style={StatisticStyle}>
                      {statistics.status.series.fetched[index].toLocaleString()}
                    </Typography.Text>
                  </td>
                  <td
                    className={"table-cell-hover"}
                    onClick={() => {
                      handleSetSearchCriteria(
                        statistics.expiration.series[index].name,
                        "fetching",
                      );
                    }}
                  >
                    <Typography.Text style={StatisticStyle}>
                      {statistics.status.series.fetching[
                        index
                      ].toLocaleString()}
                    </Typography.Text>
                  </td>
                  <td
                    className={"table-cell-hover"}
                    onClick={() => {
                      handleSetSearchCriteria(
                        statistics.expiration.series[index].name,
                        "invalidated",
                      );
                    }}
                  >
                    <Typography.Text style={StatisticStyle}>
                      {statistics.status.series.invalidated[
                        index
                      ].toLocaleString()}
                    </Typography.Text>
                  </td>
                  <td
                    className={"table-cell-hover"}
                    onClick={() => {
                      handleSetSearchCriteria(
                        statistics.expiration.series[index].name,
                        "failed",
                      );
                    }}
                  >
                    <Typography.Text style={StatisticStyle}>
                      {statistics.status.series.failed[index].toLocaleString()}
                    </Typography.Text>
                  </td>
                  <td
                    className={"table-cell-hover"}
                    onClick={() => {
                      handleSetSearchCriteria(
                        statistics.expiration.series[index].name,
                        "not_found",
                      );
                    }}
                  >
                    <Typography.Text style={StatisticStyle}>
                      {statistics.status.series.not_found[
                        index
                      ].toLocaleString()}
                    </Typography.Text>
                  </td>
                  <td
                    className={"table-cell-hover"}
                    onClick={() => {
                      handleSetSearchCriteria(
                        statistics.expiration.series[index].name,
                        "cancelled",
                      );
                    }}
                  >
                    <Typography.Text style={StatisticStyle}>
                      {statistics.status.series.cancelled[
                        index
                        ].toLocaleString()}
                    </Typography.Text>
                  </td>
                  <td
                    className={"table-cell-hover"}
                    onClick={() => {
                      handleSetSearchCriteria(
                        statistics.expiration.series[index].name,
                        "queued",
                      );
                    }}
                  >
                    <Typography.Text style={StatisticStyle}>
                      {statistics.status.series.queued[index].toLocaleString()}
                    </Typography.Text>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Steps
        direction={"vertical"}
        progressDot={true}
        current={step}
        items={[
          {
            title: "Re-drive Criteria",
            subTitle:
              "Select the Metadata Fetch Job type and status to re-drive",
            description: (
              <Space
                size={4}
                direction={"vertical"}
                style={{ width: "100%" }}
                styles={{ item: { width: "100%" } }}
              >
                <Row align={"middle"} gutter={8} style={{ marginTop: 16 }}>
                  <Col span={3}>
                    <Typography.Text
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Job Type:
                    </Typography.Text>
                  </Col>
                  <Col span={18}>
                    <Select
                      style={{ width: 350 }}
                      size={"small"}
                      value={queryJobType}
                      onChange={(value) => {
                        setQueryJobType(value);
                      }}
                      options={[
                        { label: "Languages", value: "languages" },
                        { label: "Countries", value: "countries" },
                        { label: "Genres", value: "genres" },
                        { label: "Certifications", value: "certifications" },
                        {
                          label: "Production Companies",
                          value: "production_companies",
                        },
                        { label: "Keywords", value: "keywords" },
                        { label: "TV Networks", value: "tv_networks" },
                        { label: "Collections", value: "collections" },
                        { label: "People", value: "people" },
                        { label: "TV Episodes", value: "tv_episodes" },
                        { label: "TV Seasons", value: "tv_seasons" },
                        { label: "TV Series", value: "tv_series" },
                        { label: "Movies", value: "movies" },
                      ]}
                    />
                  </Col>
                </Row>
                <Row gutter={8} align={"middle"}>
                  <Col span={3}>
                    <Typography.Text
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Job Status:
                    </Typography.Text>
                  </Col>
                  <Col span={18}>
                    <MetadataJobStatusSelect
                      value={queryStatus}
                      onChange={(value) => {
                        setQueryStatus(value);
                      }}
                      style={{ width: 350 }}
                      bordered={true}
                    />
                  </Col>
                </Row>
              </Space>
            ),
          },
          {
            title: "Re-drive Options",
            subTitle: "Select target options for the re-driven jobs",
            description: (
              <Space
                size={4}
                direction={"vertical"}
                style={{ width: "100%" }}
                styles={{ item: { width: "100%" } }}
              >
                <Row align={"middle"} gutter={8} style={{ marginTop: 16 }}>
                  <Col span={3}>
                    <Typography.Text
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Job Status:
                    </Typography.Text>
                  </Col>
                  <Col span={18}>
                    <MetadataJobStatusSelect
                      value={targetJobStatus}
                      onChange={(value) => {
                        setTargetJobStatus(value);
                      }}
                      style={{ width: 350 }}
                      bordered={true}
                    />
                  </Col>
                </Row>
                <Row align={"middle"} gutter={8} style={{ marginTop: 16 }}>
                  <Col span={3}>
                    <Typography.Text
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Republish:
                    </Typography.Text>
                  </Col>
                  <Col span={18}>
                    <Switch
                      value={republish}
                      onChange={(value) => {
                        setRepublish(value);
                      }}
                    />
                  </Col>
                </Row>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  );
};
export default RedriveModal;

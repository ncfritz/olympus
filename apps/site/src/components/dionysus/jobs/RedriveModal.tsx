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
import { useState } from "react";
import batchJobApi from "../../../api/batchJobApi";
import { Events, publish } from "../../../utils/events";
import MetadataStatusTable from "../metadata/MetadataStatusTable";
import MetadataJobStatusSelect from "./MetadataJobStatusSelect";

export interface RedriveModalProps {
  open: boolean;
  onClose: () => void;
  statistics: any;
}

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

      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "success",
        message: "Re-drive created",
        description: "The re-drive job was created successfully",
      });

      closeModal();
    } catch {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
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
        <MetadataStatusTable
          statistics={statistics}
          onCellClick={handleSetSearchCriteria}
        />
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

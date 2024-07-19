import {
  Button,
  Col,
  Empty,
  Modal,
  Result,
  Row,
  Space,
  Steps,
  Typography,
} from "antd";
import { type ReactNode, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { DataSummaryResponse } from "../../../pages/api/themis/user/[username]/data/dataSummary";
import type { JobInfo } from "../../../types/themis";

export interface ImportJobInfoModalProps {
  isOpen: boolean;
  username: string;
  dataSummary?: DataSummaryResponse;
  importFunction: (info: JobInfo) => Promise<void>;
  onClose: () => void;
}

const ImportCrStatsModal: React.FunctionComponent<ImportJobInfoModalProps> = ({
  isOpen,
  username,
  dataSummary,
  importFunction,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [jobInfo, setJobInfo] = useState<JobInfo | undefined>(undefined);
  const [jobInfoError, setJobInfoError] = useState(false);

  const closeModal = () => {
    onClose();
  };

  const loadJobInfoForYear = async (year: string) => {
    setJobInfoError(false);

    try {
      const response = await themisApi.getJobInfo(username, year);
      setJobInfo(response.jobInfo);
    } catch (e) {
      setJobInfoError(true);
    }
  };

  const modalButtons: ReactNode[] = [];
  let contents: ReactNode = <></>;

  switch (currentStep) {
    case 0:
      // eslint-disable-next-line no-case-declarations
      const availableYears: string[] = [];
      Object.entries(dataSummary || []).forEach(([key, value]) => {
        if (value.jobInfo) {
          availableYears.push(key);
        }
      });

      if (availableYears.length <= 0) {
        contents = (
          <Empty description={"No Job Info from other years available"} />
        );
      } else {
        contents = (
          <Row gutter={8}>
            {availableYears.map((year) => {
              return (
                <Col span={2}>
                  <Button
                    type={"default"}
                    onClick={async () => {
                      await loadJobInfoForYear(year);
                      setCurrentStep(currentStep + 1);
                    }}
                  >
                    {year}
                  </Button>
                </Col>
              );
            })}
          </Row>
        );
      }
      break;
    case 1:
      // eslint-disable-next-line no-case-declarations
      let content;

      if (jobInfoError) {
        content = <Result status={"error"} title={"Parsing Failed!"} />;
      } else {
        content = (
          <Space direction={"vertical"} style={{ width: "100%" }}>
            <Row gutter={8}>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Employee ID:</Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.employeeId}</Typography.Text>
              </Col>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Department ID:</Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.departmentId}</Typography.Text>
              </Col>
              <Col span={2} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Manager:</Typography.Text>
              </Col>
              <Col span={1}>
                <Typography.Text>{jobInfo?.isManager}</Typography.Text>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Title:</Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.title}</Typography.Text>
              </Col>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>
                  Department Name:
                </Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.departmentName}</Typography.Text>
              </Col>
              <Col span={2} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Coaching:</Typography.Text>
              </Col>
              <Col span={1}>
                <Typography.Text>
                  {jobInfo?.isUnderPerformanceCoaching}
                </Typography.Text>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Job Title:</Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.jobTitle}</Typography.Text>
              </Col>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Promotion Year:</Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.promotionYear}</Typography.Text>
              </Col>
              <Col span={2} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>In Pivot:</Typography.Text>
              </Col>
              <Col span={1}>
                <Typography.Text>{jobInfo?.isInPivot}</Typography.Text>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Level:</Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.level}</Typography.Text>
              </Col>
              <Col span={4} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>
                  Promotion Quarter:
                </Typography.Text>
              </Col>
              <Col span={6}>
                <Typography.Text>{jobInfo?.promotionQuarter}</Typography.Text>
              </Col>
              <Col span={2} style={{ textAlign: "end" }}>
                <Typography.Text strong={true}>Notified:</Typography.Text>
              </Col>
              <Col span={1}>
                <Typography.Text>{jobInfo?.isNotifiedOfPivot}</Typography.Text>
              </Col>
            </Row>
          </Space>
        );
      }

      modalButtons.push(
        <Button
          type={"primary"}
          disabled={jobInfoError || !jobInfo}
          onClick={async () => {
            await importFunction(jobInfo!);
            closeModal();
          }}
        >
          Import Job Info
        </Button>,
      );
      contents = content;
      break;
  }

  if (currentStep > 0) {
    modalButtons.unshift(
      <Button
        type={"default"}
        onClick={() => {
          setCurrentStep(currentStep - 1);
        }}
      >
        Back
      </Button>,
    );
  }

  return (
    <Modal
      width={1000}
      open={isOpen}
      title={"Import Job Info"}
      onCancel={closeModal}
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
              {modalButtons}
            </Space>
          </Space>
        );
      }}
    >
      <Space direction={"vertical"} size={32} style={{ width: "100%" }}>
        <Steps
          current={currentStep}
          items={[
            {
              title: "Select Year",
            },
            {
              title: "Review",
            },
          ]}
        />
        {contents}
      </Space>
    </Modal>
  );
};
export default ImportCrStatsModal;

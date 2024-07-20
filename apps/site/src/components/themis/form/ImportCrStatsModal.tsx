import { InboxOutlined } from "@ant-design/icons";
import {
  Button,
  Col,
  Form,
  Input,
  Modal,
  Result,
  Row,
  Space,
  Steps,
  Typography,
  Upload,
} from "antd";
import { type ReactNode, useState } from "react";
import type { CRStat } from "../../../types/themis";

const { Dragger } = Upload;

export interface ImportCrStatsModalProps {
  processStatsFunction: (input?: string) => CRStat[];
  isOpen: boolean;
  importFunction: (history: CRStat[]) => Promise<void>;
  onClose: () => void;
}

const ImportCrStatsModal: React.FunctionComponent<ImportCrStatsModalProps> = ({
  processStatsFunction,
  isOpen,
  importFunction,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rawStats, setRawStats] = useState<string | undefined>(undefined);
  const [parsingError, setParsingError] = useState(false);
  const [stats, setStats] = useState<CRStat[]>([]);

  const closeModal = () => {
    setRawStats(undefined);
    setStats([]);
    setParsingError(false);
    setCurrentStep(0);
    onClose();
  };

  const processCrStats = async () => {
    try {
      const processedEntries = processStatsFunction(rawStats);
      setStats(processedEntries);
    } catch (e) {
      setParsingError(true);
      console.log(e);
    }
  };

  const modalButtons: ReactNode[] = [];
  let contents: ReactNode = <></>;

  switch (currentStep) {
    case 0:
      modalButtons.push(
        <Button
          type={"primary"}
          onClick={async () => {
            setParsingError(false);
            await processCrStats();
            setCurrentStep(currentStep + 1);
          }}
        >
          Parse Statistics
        </Button>,
      );
      contents = (
        <Space direction={"vertical"} size={16} style={{ width: "100%" }}>
          <Dragger
            showUploadList={false}
            maxCount={1}
            beforeUpload={async (file) => {
              setRawStats(await file.text());

              // Prevent upload
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <Typography.Text>
              Click or drag file to this area to upload
            </Typography.Text>
          </Dragger>
          <Form.Item label={"Raw Statistics"} layout={"vertical"}>
            <Input.TextArea
              style={{ height: 300 }}
              value={rawStats}
              onChange={(e) => {
                setRawStats(e.currentTarget.value);
              }}
            ></Input.TextArea>
          </Form.Item>
        </Space>
      );
      break;
    case 1:
      // eslint-disable-next-line no-case-declarations
      let content;

      if (parsingError) {
        content = <Result status={"error"} title={"Parsing Failed!"} />;
      } else {
        content = (
          <Space direction={"vertical"} style={{ width: "100%" }}>
            <Space direction={"vertical"} style={{ width: "100%" }}>
              <Row style={{ borderBottom: "1px solid #e6e6e6" }}>
                <Col span={6}>Week</Col>
                <Col span={4}>Authored</Col>
                <Col span={4}>Commented</Col>
                <Col span={4}>Received</Col>
                <Col span={4}>Approved</Col>
              </Row>
            </Space>
            <Space
              direction={"vertical"}
              style={{ width: "100%", maxHeight: 300, overflow: "scroll" }}
            >
              {stats.map((stat) => {
                return (
                  <Row>
                    <Col span={6} style={{ fontSize: 11 }}>
                      {stat.week}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.authored}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.commented}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.received}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.approved}
                    </Col>
                  </Row>
                );
              })}
            </Space>
          </Space>
        );
      }

      modalButtons.push(
        <Button
          type={"primary"}
          disabled={parsingError}
          onClick={async () => {
            await importFunction(stats);
            closeModal();
          }}
        >
          Import CR Stats
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
      width={800}
      open={isOpen}
      title={"Import CR Statistics from External Source"}
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
              title: "Enter Raw Statistics",
            },
            {
              title: "Process Stats",
            },
          ]}
        />
        {contents}
      </Space>
    </Modal>
  );
};
export default ImportCrStatsModal;

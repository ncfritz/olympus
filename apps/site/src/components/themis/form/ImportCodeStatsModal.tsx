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
import type { CodeStat } from "../../../types/themis";

const { Dragger } = Upload;

export interface ImportCodeStatsModalProps {
  isOpen: boolean;
  importFunction: (history: CodeStat[]) => Promise<void>;
  onClose: () => void;
}

const ImportCodeStatsModal: React.FunctionComponent<
  ImportCodeStatsModalProps
> = ({ isOpen, importFunction, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rawStats, setRawStats] = useState<string | undefined>(undefined);
  const [parsingError, setParsingError] = useState(false);
  const [stats, setStats] = useState<CodeStat[]>([]);

  const closeModal = () => {
    onClose();
  };

  const getStatistic = (parts: string[], index: number) => {
    if (!parts) {
      return 0;
    }

    if (parts.length <= index) {
      return 0;
    }

    if (parts[index].trim() === "") {
      return 0;
    }

    return parseInt(parts[index]);
  };

  const processCodeStats = async () => {
    const processedEntries: CodeStat[] = [];
    const rawLines = rawStats?.trim().split("\n") || [];

    if (rawLines?.length < 52) {
      setParsingError(true);
    }

    rawLines.forEach((line) => {
      const parts = line.split(",", 5);

      try {
        if (parts.length <= 0) {
          setParsingError(true);
          return;
        }

        const week = parseInt(parts[0]);

        processedEntries.push({
          week: week,
          changes: getStatistic(parts, 1),
          added: getStatistic(parts, 2),
          removed: getStatistic(parts, 3),
          packages: getStatistic(parts, 4),
        });

        setStats(processedEntries);
      } catch (e) {
        setParsingError(true);
        console.log(e);
      }
    });

    setStats(processedEntries);
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
            await processCodeStats();
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
            onChange={({ file }) => {
              if (file.status === "done") {
                console.log(file);
              }
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
                <Col span={4}>Changes</Col>
                <Col span={4}>Added</Col>
                <Col span={4}>Removed</Col>
                <Col span={4}>Packages</Col>
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
                      W{stat.week}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.changes}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.added}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.removed}
                    </Col>
                    <Col
                      span={4}
                      style={{ fontSize: 11, fontFamily: "monospace" }}
                    >
                      {stat.packages}
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
          Import Code Stats
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
      title={"Import Code Statistics from External Source"}
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
export default ImportCodeStatsModal;

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
import type { SimStat } from "../../../types/themis";

const { Dragger } = Upload;

export interface ImportSimStatsModalProps {
  processStatsFunction: (input?: string) => SimStat[];
  isOpen: boolean;
  importFunction: (stats: SimStat[]) => Promise<void>;
  onClose: () => void;
}

const ImportCrStatsModal: React.FunctionComponent<ImportSimStatsModalProps> = ({
  processStatsFunction,
  isOpen,
  importFunction,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rawStats, setRawStats] = useState<string | undefined>(undefined);
  const [parsingError, setParsingError] = useState(false);
  const [stats, setStats] = useState<SimStat[]>([]);

  const closeModal = () => {
    setRawStats(undefined);
    setStats([]);
    setParsingError(false);
    setCurrentStep(0);
    onClose();
  };

  const processSimStats = async () => {
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
            await processSimStats();
            setCurrentStep(currentStep + 1);
          }}
        >
          Parse Created
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
          <Form.Item label={"Created Statistics"} layout={"vertical"}>
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
          <Space direction={"vertical"} style={{ width: "100%", rowGap: 0 }}>
            <Space direction={"vertical"} style={{ width: "100%" }}>
              <Row gutter={8}>
                <Col span={2}></Col>
                <Col span={11} style={{ textAlign: "center" }}>
                  <Typography.Text strong={true}>Created</Typography.Text>
                </Col>
                <Col span={11} style={{ textAlign: "center" }}>
                  <Typography.Text strong={true}>Resolved</Typography.Text>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={2} style={{ fontSize: 11 }} className={"b-b1 b-r1"}>
                  Week
                </Col>
                <Col span={11}>
                  <Row gutter={8}>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      1
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      2
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      3
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      4
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      5
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      99
                    </Col>
                    <Col
                      span={6}
                      style={{ fontSize: 11 }}
                      className={"b-r1 b-b1"}
                    >
                      Total
                    </Col>
                  </Row>
                </Col>
                <Col span={11}>
                  <Row gutter={8}>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      1
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      2
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      3
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      4
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      5
                    </Col>
                    <Col span={3} style={{ fontSize: 11 }} className={"b-b1"}>
                      99
                    </Col>
                    <Col span={6} style={{ fontSize: 11 }} className={"b-b1"}>
                      Total
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Space>
            <Space
              direction={"vertical"}
              style={{
                width: "100%",
                maxHeight: 300,
                overflow: "scroll",
                rowGap: 0,
              }}
            >
              {stats.map((stat) => {
                return (
                  <Row gutter={8}>
                    <Col
                      span={2}
                      style={{ fontSize: 11, textAlign: "end" }}
                      className={"b-r1"}
                    >
                      W{stat.week}
                    </Col>
                    <Col span={11}>
                      <Row gutter={8}>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.created["1"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.created["2"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.created["3"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.created["4"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.created["5"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.created["99"]}
                        </Col>
                        <Col
                          span={6}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                          className={"b-r1"}
                        >
                          {stat.created.total}
                        </Col>
                      </Row>
                    </Col>
                    <Col span={11}>
                      <Row gutter={8}>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.resolved["1"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.resolved["2"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.resolved["3"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.resolved["4"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.resolved["5"]}
                        </Col>
                        <Col
                          span={3}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.resolved["99"]}
                        </Col>
                        <Col
                          span={6}
                          style={{ fontSize: 11, fontFamily: "monospace" }}
                        >
                          {stat.resolved.total}
                        </Col>
                      </Row>
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
          Import SIM Stats
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
      width={"80%"}
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
              title: "Import Created Statistics",
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

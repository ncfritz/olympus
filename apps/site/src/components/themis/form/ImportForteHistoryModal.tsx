import { InboxOutlined } from "@ant-design/icons";
import {
  Button,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Result,
  Row,
  Space,
  Steps,
  Typography,
  Upload,
} from "antd";
import { type ReactNode, useState } from "react";
import {
  type ForteSummary,
  LEADERSHIP_PRINCIPLES,
} from "../../../types/themis";
import { EMPTY_FORTE_SUMMARY } from "../../../utils/themisData";

const { Dragger } = Upload;

export interface ImportForteHistoryModalProps {
  processForteFunction: (input?: string) => ForteSummary;
  isOpen: boolean;
  importFunction: (summary: ForteSummary) => Promise<void>;
  onClose: () => void;
}

const ImportForteHistoryModal: React.FunctionComponent<
  ImportForteHistoryModalProps
> = ({ processForteFunction, isOpen, importFunction, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rawForte, setRawForte] = useState<string | undefined>(undefined);
  const [parsingError, setParsingError] = useState(false);
  const [forte, setForte] = useState(EMPTY_FORTE_SUMMARY);

  const closeModal = () => {
    setRawForte(undefined);
    setForte(EMPTY_FORTE_SUMMARY);
    setParsingError(false);
    setCurrentStep(0);
    onClose();
  };

  const processForte = async () => {
    try {
      const processedEntries = processForteFunction(rawForte);
      setForte(processedEntries);
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
            await processForte();
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
              setRawForte(await file.text());

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
              value={rawForte}
              onChange={(e) => {
                setRawForte(e.currentTarget.value);
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
      } else if (!forte) {
        content = <Empty description={"No Forte results present"} />;
      } else {
        content = (
          <Space direction={"vertical"} style={{ width: "100%" }}>
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={10} style={{ textAlign: "end" }}>
                <Typography.Text strong={true} style={{ fontSize: 12 }}>
                  Leadership Principle
                </Typography.Text>
              </Col>
              <Col span={7} style={{ textAlign: "end" }}>
                <Typography.Text strong={true} style={{ fontSize: 12 }}>
                  Growth Opportunity
                </Typography.Text>
              </Col>
              <Col span={7}>
                <Typography.Text strong={true} style={{ fontSize: 12 }}>
                  Super Power
                </Typography.Text>
              </Col>
            </Row>
            {Object.entries(LEADERSHIP_PRINCIPLES).map(([key, value]) => {
              const growthValue = forte[key as keyof ForteSummary].opportunity;
              const strengthValue = forte[key as keyof ForteSummary].strength;

              return (
                <Row gutter={12}>
                  <Col span={10} style={{ textAlign: "end", fontSize: 10 }}>
                    {value}
                  </Col>
                  <Col span={7}>
                    <Progress
                      percent={(growthValue / 10) * 100}
                      style={{ direction: "rtl" }}
                      format={(percent) => {
                        return (
                          <Typography.Text
                            style={{ fontSize: 10, fontFamily: "monospace" }}
                          >
                            {((percent || 0) / 100) * 10}
                          </Typography.Text>
                        );
                      }}
                    />
                  </Col>
                  <Col span={7}>
                    <Progress
                      percent={(strengthValue / 10) * 100}
                      format={(percent) => {
                        return (
                          <Typography.Text
                            style={{ fontSize: 10, fontFamily: "monospace" }}
                          >
                            {((percent || 0) / 100) * 10}
                          </Typography.Text>
                        );
                      }}
                    ></Progress>
                  </Col>
                </Row>
              );
            })}
          </Space>
        );
      }

      modalButtons.push(
        <Button
          type={"primary"}
          disabled={parsingError || !forte}
          onClick={async () => {
            await importFunction(forte!);
            closeModal();
          }}
        >
          Import Forte
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
      title={"Import Forte Data from External Source"}
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
              title: "Enter Raw Forte Data",
            },
            {
              title: "Process Forte",
            },
          ]}
        />
        {contents}
      </Space>
    </Modal>
  );
};
export default ImportForteHistoryModal;

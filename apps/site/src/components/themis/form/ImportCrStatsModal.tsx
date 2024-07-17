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
} from "antd";
import { type ReactNode, useState } from "react";
import type { CRStat } from "../../../types/themis";

export interface ImportCrStatsModalProps {
  isOpen: boolean;
  importFunction: (history: CRStat[]) => Promise<void>;
  onClose: () => void;
}

const ImportCrStatsModal: React.FunctionComponent<ImportCrStatsModalProps> = ({
  isOpen,
  importFunction,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rawStats, setRawStats] = useState<string | undefined>(undefined);
  const [parsingError, setParsingError] = useState(false);
  const [stats, setStats] = useState<CRStat[]>([]);

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

  const processCrStats = async () => {
    const processedEntries: CRStat[] = [];
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
          authored: getStatistic(parts, 1),
          commented: getStatistic(parts, 2),
          received: getStatistic(parts, 3),
          approved: getStatistic(parts, 4),
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
            await processCrStats();
            setCurrentStep(currentStep + 1);
          }}
        >
          Parse Statistics
        </Button>,
      );
      contents = (
        <Form.Item label={"Raw Statistics"} layout={"vertical"}>
          <Input.TextArea
            style={{ height: 300 }}
            value={rawStats}
            onChange={(e) => {
              setRawStats(e.currentTarget.value);
            }}
          ></Input.TextArea>
        </Form.Item>
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

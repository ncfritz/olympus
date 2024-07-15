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
} from "antd";
import { DateTime } from "luxon";
import { type ReactNode, useState } from "react";
import year from "../../../pages/themis/review/[year]";
import type { CRStat, SimSeverityStats, SimStat } from "../../../types/themis";

export interface ImportSimStatsModalProps {
  year: string;
  isOpen: boolean;
  importFunction: (history: SimStat[]) => Promise<void>;
  onClose: () => void;
}

const ImportCrStatsModal: React.FunctionComponent<ImportSimStatsModalProps> = ({
  year,
  isOpen,
  importFunction,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rawCreatedStats, setRawCreatedStats] = useState<string | undefined>(
    undefined,
  );
  const [rawCreatedValid, setRawCreatedValid] = useState(false);
  const [parsedCreatedStats, setParsedCreatedStats] = useState<any | undefined>(
    undefined,
  );
  const [rawResolvedValid, setRawResolvedValid] = useState(false);
  const [rawResolvedStats, setRawResolvedStats] = useState<string | undefined>(
    undefined,
  );
  const [parsedResolvedStats, setParsedResolvedStats] = useState<
    any | undefined
  >(undefined);
  const [parsingError, setParsingError] = useState(false);
  const [stats, setStats] = useState<SimStat[]>([]);

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

  const processSimStats = async () => {
    const processedEntries: SimStat[] = [];
    const targetYear = DateTime.fromISO(year);

    if (
      Object.keys(parsedCreatedStats).length < 52 ||
      Object.keys(parsedResolvedStats).length < 52
    ) {
      setParsingError(true);
    }

    try {
      for (let i = 1; i <= targetYear.weeksInWeekYear; i++) {
        processedEntries.push({
          week: i,
          created: buildSimSeverityEntry(parsedCreatedStats[i.toString()]),
          resolved: buildSimSeverityEntry(parsedResolvedStats[i.toString()]),
        });
      }

      setStats(processedEntries);
    } catch (e) {
      setParsingError(true);
      console.log(e);
    }
  };

  const buildSimSeverityEntry = (raw: any) => {
    const severityStat: SimSeverityStats = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "99": 0,
      total: 0,
    };

    ["1", "2", "3", "4", "5", "99"].forEach((severity) => {
      const value = Object.keys(raw).includes(severity) ? raw[severity] : 0;
      severityStat[severity as keyof SimSeverityStats] = value;
      severityStat["total"] += value;
    });

    return severityStat;
  };

  const modalButtons: ReactNode[] = [];
  let contents: ReactNode = <></>;

  switch (currentStep) {
    case 0:
      modalButtons.push(
        <Button
          type={"primary"}
          disabled={!rawCreatedValid}
          onClick={async () => {
            setCurrentStep(currentStep + 1);
          }}
        >
          Parse Created
        </Button>,
      );
      contents = (
        <Form.Item label={"Created Statistics"} layout={"vertical"}>
          <Input.TextArea
            style={{ height: 300 }}
            value={rawCreatedStats}
            onChange={(e) => {
              setRawCreatedStats(e.currentTarget.value);

              try {
                setParsedCreatedStats(JSON.parse(e.currentTarget.value));
                setRawCreatedValid(true);
              } catch (e) {
                setRawCreatedValid(false);
              }
            }}
          ></Input.TextArea>
        </Form.Item>
      );
      break;
    case 1:
      modalButtons.push(
        <Button
          type={"primary"}
          disabled={!rawResolvedValid}
          onClick={async () => {
            setCurrentStep(currentStep + 1);
            await processSimStats();
          }}
        >
          Parse Resolved
        </Button>,
      );
      contents = (
        <Form.Item label={"Resolved Statistics"} layout={"vertical"}>
          <Input.TextArea
            style={{ height: 300 }}
            value={rawResolvedStats}
            onChange={(e) => {
              setRawResolvedStats(e.currentTarget.value);

              try {
                setParsedResolvedStats(JSON.parse(e.currentTarget.value));
                setRawResolvedValid(true);
              } catch (e) {
                setRawResolvedValid(false);
              }
            }}
          ></Input.TextArea>
        </Form.Item>
      );
      break;
    case 2:
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
            console.log(stats);
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
              title: "Import Resolved Statistics",
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

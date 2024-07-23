import {CheckOutlined} from "@ant-design/icons";
import {Button, Col, Empty, Form, Input, Modal, Result, Row, Space, Steps, Typography} from "antd";
import { DateTime } from "luxon";
import { type ReactNode, useState } from "react";
import type { JobHistoryEntry } from "../../../types/themis";

export interface ImportJobHistoryModalProps {
  isOpen: boolean;
  importFunction: (history: JobHistoryEntry[]) => Promise<void>;
  onClose: () => void;
}

const JOB_CODE_TITLE: Record<string, string> = {
  "900601": "Technical Sourcer/Recruiter",
  A07153: "Technical Sourcer/Recruiter",
  M04151: "Techical Content Manager",
  T03142: "Amazon Technical Academy",
  T03181: "Software Development Engineer",
  T03141: "Software Development Engineer",
  T03101: "Software Development Engineer",
  T03081: "Software Development Manager",
  T03121: "Software Development Manager",
  "901067": "Tech Consultant",
  T25141: "IT Application Development Engineer",
};

const ImportJobHistoryModal: React.FunctionComponent<
  ImportJobHistoryModalProps
> = ({ isOpen, importFunction, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [rawJson, setRawJson] = useState<string | undefined>(undefined);
  const [rawJsonValid, setRawJsonValid] = useState(false);
  const [parsedJson, setParsedJson] = useState<any>({});
  const [parsingError, setParsingError] = useState(false);
  const [entries, setEntries] = useState<JobHistoryEntry[]>([]);

  const closeModal = () => {
    onClose();
  };

  const processJobHistory = async () => {
    const processedEntries: JobHistoryEntry[] = [];
    const jobHistory = parsedJson.data?.getJobInfo?.jobHistory;
    const jobEvents: any[] = parsedJson.jobEvents;

    if (jobHistory) {
      jobHistory.forEach((history: any, i: number) => {
        const effectiveDate = DateTime.fromISO(history.effectiveDate);

        const entry: any = {
          fte: history.badgeColor === "BLUE",
          start: effectiveDate.toISODate(),
          jobTitle:
            history.jobCode in JOB_CODE_TITLE
              ? JOB_CODE_TITLE[history.jobCode]
              : history.jobCode,
          level: history.jobLevel !== null ? history.jobLevel : "99",
        };

        if (history.terminationDate) {
          entry.end = DateTime.fromISO(history.terminationDate).toISODate();
        }

        if (processedEntries.length > 0 && !processedEntries[i - 1].end) {
          processedEntries[i - 1].end = effectiveDate.toISODate()!;
        }

        processedEntries.push(entry);
      });
    } else if (jobEvents) {
      jobEvents.sort((a: any, b: any) => {
        return a.startDate.localeCompare(b.startDate);
      }).forEach((event: any, i: number) => {
          const startDate = DateTime.fromISO(event.startDate);
          const endDate: DateTime | undefined = event.endDate ? DateTime.fromISO(event.endDate) : undefined;

          const entry: any = {
            fte: event.role !== 'Vendor',
            start: startDate.toISODate(),
            end: endDate?.toISODate(),
            jobTitle:
              event.jobCode in JOB_CODE_TITLE
                ? JOB_CODE_TITLE[event.jobCode]
                : event.jobCode,
            level: event.level !== null ? event.level : "99",
          };

          //if (history.terminationDate) {
          //  entry.end = DateTime.fromISO(history.terminationDate).toISODate();
          //}

          if (processedEntries.length > 0 && !processedEntries[i - 1].end) {
            processedEntries[i - 1].end = startDate.toISODate()!;
          }

          processedEntries.push(entry);
        })
      }

    processedEntries[processedEntries.length - 1].end =
      DateTime.utc().toISODate();
    setEntries(processedEntries);
  };

  const modalButtons: ReactNode[] = [];
  let contents: ReactNode = <></>;

  switch (currentStep) {
    case 0:
      contents = (
        <Form.Item label={"Raw JSON"} layout={"vertical"}>
          <Input.TextArea
            style={{ height: 400 }}
            value={rawJson}
            onChange={(e) => {
              setRawJson(e.currentTarget.value);

              try {
                setParsedJson(JSON.parse(e.currentTarget.value));
                setRawJsonValid(true);
              } catch (e) {
                setRawJsonValid(false);
              }
            }}
          ></Input.TextArea>
        </Form.Item>
      );

      modalButtons.push(
        <Button
          type={"primary"}
          disabled={!rawJsonValid}
          onClick={async () => {
            await processJobHistory();
            setCurrentStep(currentStep + 1);
          }}
        >
          Process Entries
        </Button>,
      );

      break;
    case 1:
      // eslint-disable-next-line no-case-declarations
      let content;

      if (parsingError) {
        content = <Result status={"error"} title={"Parsing Failed!"} />;
      } else if (entries.length <= 0) {
        content = <Empty description={"No Forte results present"} />;
      } else {
        content = (
          <Space direction={"vertical"} style={{width: "100%"}}>
            <Space direction={"vertical"} style={{ width: "100%" }}>
              <Row style={{ borderBottom: "1px solid #e6e6e6" }}>
              <Col span={8}>
                  Job Title
              </Col>
              <Col span={6}>
                  Start Date
              </Col>
              <Col span={6}>
                  End Date
              </Col>
              <Col span={2}>
                  Level
              </Col>
              <Col span={2}>
                  FTE
              </Col>
            </Row>
            </Space>
            <Space
              direction={"vertical"}
              style={{ width: "100%", maxHeight: 400, overflowY: "scroll" }}
            >
            {entries.map((entry) => {
              return (
                <Row>
                  <Col span={8}>
                    {entry.jobTitle}
                  </Col>
                  <Col span={6}>
                    {entry.start}
                  </Col>
                  <Col span={6}>
                    {entry.end}
                  </Col>
                  <Col span={2}>
                    L{entry.level}
                  </Col>
                  <Col span={2}>
                    {entry.fte ? <CheckOutlined /> : ""}
                  </Col>
                </Row>
              )
            })}
            </Space>
          </Space>
        );
      }

      modalButtons.push(
        <Button
          type={"primary"}
          onClick={async () => {
            await importFunction(entries);
            closeModal();
          }}
        >
          Import Job History
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
      title={"Import Job History from External Source"}
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
              title: "Enter JSON",
            },
            {
              title: "Process Job History",
            },
          ]}
        />
        {contents}
      </Space>
    </Modal>
  );
};
export default ImportJobHistoryModal;

import { Button, Form, Input, Modal, Space, Steps } from "antd";
import { DateTime } from "luxon";
import dynamic from "next/dynamic";
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
  "901067": "Tech Consultant",
  T25141: "IT Application Development Engineer",
};

const ImportJobHistoryModal: React.FunctionComponent<
  ImportJobHistoryModalProps
> = ({ isOpen, importFunction, onClose }) => {
  const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });

  const [currentStep, setCurrentStep] = useState(0);
  const [rawJson, setRawJson] = useState<string | undefined>(undefined);
  const [rawJsonValid, setRawJsonValid] = useState(false);
  const [parsedJson, setParsedJson] = useState([]);
  const [entries, setEntries] = useState<JobHistoryEntry[]>([]);

  const closeModal = () => {
    onClose();
  };

  const processJobHistory = async () => {
    const processedEntries: JobHistoryEntry[] = [];

    parsedJson.forEach((history: any, i: number) => {
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

    processedEntries[processedEntries.length - 1].end =
      DateTime.utc().toISODate();
    setEntries(processedEntries);
  };

  const modalButtons: ReactNode[] = [];
  let contents: ReactNode = <></>;

  switch (currentStep) {
    case 0:
      modalButtons.push(
        <Button
          type={"primary"}
          disabled={!rawJsonValid}
          onClick={() => {
            setCurrentStep(currentStep + 1);
          }}
        >
          Parse JSON
        </Button>,
      );
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
      break;
    case 1:
      modalButtons.push(
        <Button
          type={"primary"}
          onClick={async () => {
            try {
              await processJobHistory();
              setCurrentStep(currentStep + 1);
            } catch (e) {
              console.log(e);
            }
          }}
        >
          Extract Job History
        </Button>,
      );
      contents = (
        <DynamicReactJson
          style={{
            padding: 16,
            fontSize: 10,
            height: 400,
            overflow: "scroll",
            border: "1px solid #e6e6e6",
            borderRadius: 5,
          }}
          src={parsedJson}
          indentWidth={2}
          iconStyle={"square"}
          displayDataTypes={false}
          enableClipboard={true}
        />
      );
      break;
    case 2:
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
      contents = <>{JSON.stringify(entries)}</>;
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
              title: "Review JSON",
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

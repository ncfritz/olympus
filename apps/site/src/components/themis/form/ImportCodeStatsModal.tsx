import {Button, Form, Input, Modal, Result, Space, Steps} from "antd";
import { DateTime } from "luxon";
import dynamic from "next/dynamic";
import { type ReactNode, useState } from "react";
import type { CodeStat } from "../../../types/themis";

export interface ImportJobHistoryModalProps {
  isOpen: boolean;
  importFunction: (history: CodeStat[]) => Promise<void>;
  onClose: () => void;
}

const ImportCodeStatsModal: React.FunctionComponent<
  ImportJobHistoryModalProps
> = ({ isOpen, importFunction, onClose }) => {
  const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });

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
        const date = DateTime.fromISO(parts[0]);

        if (parts.length <= 0) {
          setParsingError(true);
          return;
        }

        processedEntries.push({
          date: date.toISODate()!,
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
        content = <>{JSON.stringify(stats)}</>;
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

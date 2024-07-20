import { InboxOutlined } from "@ant-design/icons";
import { Button, Col, Row, Space, Typography, Upload } from "antd";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import type { CodeStat } from "../../../types/themis";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import CodeStatsEntryRow from "../form/CodeStatsEntryRow";
import ImportCodeStatsModal from "../form/ImportCodeStatsModal";
import CodeGraph from "../graph/CodeGraph";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

const { Dragger } = Upload;

export type CodeStatsFormData = {
  stats: CodeStat[];
};

const buildEmptyForm = (year: string): CodeStatsFormData => {
  const statisticsYear = DateTime.fromISO(year).startOf("year");

  return {
    stats: new Array(statisticsYear.weeksInWeekYear)
      .fill(0)
      .map((value, index) => {
        const currentDate = statisticsYear.set({ weekNumber: index });

        return {
          week: currentDate.weeksInWeekYear,
          changes: 0,
          added: 0,
          removed: 0,
          packages: 0,
        };
      }),
  };
};

const CodeStatsPanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [codeStats, setCodeStats] = useState<CodeStat[] | undefined>([]);
  const [codeStatsLoading, setCodeStatsLoading] = useState(false);
  const [codeStatsError, setCodeStatsError] = useState(false);

  const { handleSubmit, control, register, reset, watch } =
    useForm<CodeStatsFormData>({
      defaultValues: buildEmptyForm(year),
    });
  const { fields } = useFieldArray({
    control,
    name: "stats",
  });

  const statsWatch = watch("stats");

  const loadCodeStats = async (quiet: boolean = false) => {
    if (!quiet) {
      setCodeStatsLoading(true);
    }

    setCodeStatsError(false);

    try {
      const response = await themisApi.getCodeStats(username, year);
      setCodeStats(response.stats);

      if (response.stats?.length > 50) {
        reset(response);
      }
    } catch (e) {
      setCodeStatsError(true);
    } finally {
      setCodeStatsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadCodeStats(false);
    })();
  }, [username, year]);

  useEffect(() => {}, [statsWatch]);

  const onSubmit = async (data: CodeStatsFormData) => {
    try {
      await themisApi.upsertCodeStats(username, year, data.stats);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Code stats saved",
        description: "Code statistics have been successfully saved",
      });

      await afterSave();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save code stats",
        description: "Unable to save code statistics due to a server error",
      });
    }
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

  const processCodeStats = (input?: string) => {
    if (!input) {
      throw "No input!";
    }

    const processedEntries: CodeStat[] = [];
    const rawLines = input?.trim().split("\n") || [];

    if (rawLines?.length < 52) {
      throw "Input length < 52 lines";
    }

    rawLines.forEach((line) => {
      const parts = line.split(",", 5);

      if (parts.length <= 0) {
        throw "Invalid stats row";
      }

      const week = parseInt(parts[0]);

      processedEntries.push({
        week: week,
        changes: getStatistic(parts, 1),
        added: getStatistic(parts, 2),
        removed: getStatistic(parts, 3),
        packages: getStatistic(parts, 4),
      });
    });

    return processedEntries;
  };

  const formRows = fields
    .sort((a, b) => {
      return a.week === b.week ? 0 : a.week - b.week > 0 ? 1 : -1;
    })
    .map((field, index) => {
      return (
        <CodeStatsEntryRow
          week={field.week}
          index={index}
          control={control}
          register={register}
        />
      );
    });

  return (
    <Row>
      <Col span={10}>
        <Row gutter={8}>
          <Col span={4} style={{ textAlign: "end" }}>
            <Typography.Text strong={true}>Week</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Changes</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Added</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Removed</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Packages</Typography.Text>
          </Col>
        </Row>
        {formRows}
        <Row gutter={8}>
          <Col span={2} offset={4}>
            <Space direction={"horizontal"} size={8}>
              <Button
                type={"primary"}
                onClick={async () => {
                  await handleSubmit(onSubmit)();
                }}
              >
                Save
              </Button>
              <Button
                type={"default"}
                onClick={() => {
                  setImportModalOpen(true);
                }}
              >
                Import
              </Button>
            </Space>
          </Col>
        </Row>
      </Col>
      <Col span={14}>
        <Dragger
          height={120}
          style={{
            marginBottom: 16,
          }}
          showUploadList={false}
          maxCount={1}
          beforeUpload={async (file) => {
            try {
              reset({ stats: processCodeStats(await file.text()) });
            } catch (e) {
              publish(PUBLISH_EVENT, {
                type: "error",
                message: "Failed to parse code statistics",
                description: "Unable to parse code statistics!",
              });
            }

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
        <CodeGraph
          axisLabel={"Changes"}
          data={{ [year]: statsWatch }}
          stat={"changes"}
          max={100}
          inferMax={true}
        />
        <CodeGraph
          axisLabel={"SLOC Added"}
          data={{ [year]: statsWatch }}
          stat={"added"}
          inferMax={true}
        />
        <CodeGraph
          axisLabel={"SLOC Removed"}
          data={{ [year]: statsWatch }}
          stat={"removed"}
          inferMax={true}
        />
        <CodeGraph
          axisLabel={"Packages"}
          data={{ [year]: statsWatch }}
          stat={"packages"}
          max={30}
          inferMax={true}
        />
      </Col>
      <ImportCodeStatsModal
        isOpen={importModalOpen}
        processStatsFunction={processCodeStats}
        importFunction={async (stats) => {
          reset({ stats: stats });
        }}
        onClose={() => {
          setImportModalOpen(false);
        }}
      />
    </Row>
  );
};
export default CodeStatsPanel;

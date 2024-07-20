import {InboxOutlined} from "@ant-design/icons";
import { Button, Col, Row, Space, Typography, Upload } from "antd";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import type { CRStat } from "../../../types/themis";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import CRStatsEntryRow from "../form/CRStatsEntryRow";
import ImportCrStatsModal from "../form/ImportCrStatsModal";
import CRGraph from "../graph/CRGraph";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

const { Dragger } = Upload;

export type CRStatsFormData = {
  stats: CRStat[];
};

const buildEmptyForm = (year: string): CRStatsFormData => {
  const statisticsYear = DateTime.fromISO(year).startOf("year");

  return {
    stats: new Array(statisticsYear.weeksInWeekYear)
      .fill(0)
      .map((value, index) => {
        const currentDate = statisticsYear.set({ weekNumber: index });

        return {
          week: currentDate.weeksInWeekYear,
          authored: 0,
          commented: 0,
          received: 0,
          approved: 0,
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
  const [crStats, setCrStats] = useState<CRStat[] | undefined>([]);
  const [crStatsLoading, setCrStatsLoading] = useState(false);
  const [crStatsError, setCrStatsError] = useState(false);

  const { handleSubmit, control, register, reset, watch } =
    useForm<CRStatsFormData>({
      defaultValues: buildEmptyForm(year),
    });
  const { fields } = useFieldArray({
    control,
    name: "stats",
  });

  const statsWatch = watch("stats");

  const loadCodeStats = async (quiet: boolean = false) => {
    if (!quiet) {
      setCrStatsLoading(true);
    }

    setCrStatsError(false);

    try {
      const response = await themisApi.getCrStats(username, year);
      setCrStats(response.stats);

      if (response.stats?.length > 50) {
        reset(response);
      }
    } catch (e) {
      setCrStatsError(true);
    } finally {
      setCrStatsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadCodeStats(false);
    })();
  }, [username, year]);

  useEffect(() => {}, [statsWatch]);

  const onSubmit = async (data: CRStatsFormData) => {
    try {
      await themisApi.upsertCrStats(username, year, data.stats);

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

  const processCrStats = (input?: string) => {
    if (!input) {
      throw "No input!";
    }

    const processedEntries: CRStat[] = [];
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
        authored: getStatistic(parts, 1),
        commented: getStatistic(parts, 2),
        received: getStatistic(parts, 3),
        approved: getStatistic(parts, 4),
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
        <CRStatsEntryRow
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
            <Typography.Text strong={true}>Authored</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Commented</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Received</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Approved</Typography.Text>
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
              reset({ stats: processCrStats(await file.text()) });
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
        <CRGraph
          axisLabel={"Authored"}
          data={{ [year]: statsWatch }}
          stat={"authored"}
          max={100}
          inferMax={true}
        />
        <CRGraph
          axisLabel={"Commented On"}
          data={{ [year]: statsWatch }}
          stat={"commented"}
          inferMax={true}
        />
        <CRGraph
          axisLabel={"Received"}
          data={{ [year]: statsWatch }}
          stat={"received"}
          inferMax={true}
        />
        <CRGraph
          axisLabel={"Approved"}
          data={{ [year]: statsWatch }}
          stat={"approved"}
          max={30}
          inferMax={true}
        />
      </Col>
      <ImportCrStatsModal
        processStatsFunction={processCrStats}
        isOpen={importModalOpen}
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

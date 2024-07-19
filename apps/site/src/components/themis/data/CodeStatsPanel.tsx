import { Button, Col, Row, Space, Typography } from "antd";
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
      <Col span={10}>
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

import { Button, Col, Row, Space, Typography } from "antd";
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
          date: currentDate.toISODate()!,
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

  const formRows = fields
    .sort((a, b) => {
      return a.date.localeCompare(b.date);
    })
    .map((field, index) => {
      return (
        <CRStatsEntryRow
          date={DateTime.fromISO(field.date)}
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
          <Col span={2} offset={5}>
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
        <CRGraph
          axisLabel={"Authored"}
          data={statsWatch}
          stat={"authored"}
          max={100}
          inferMax={true}
        />
        <CRGraph
          axisLabel={"Commented On"}
          data={statsWatch}
          stat={"commented"}
          inferMax={true}
        />
        <CRGraph
          axisLabel={"Received"}
          data={statsWatch}
          stat={"received"}
          inferMax={true}
        />
        <CRGraph
          axisLabel={"Approved"}
          data={statsWatch}
          stat={"approved"}
          max={30}
          inferMax={true}
        />
      </Col>
      <ImportCrStatsModal
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

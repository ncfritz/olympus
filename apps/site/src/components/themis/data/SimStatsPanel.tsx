import {InboxOutlined} from "@ant-design/icons";
import {Button, Col, Row, Space, Typography, Upload} from "antd";
import {DateTime} from "luxon";
import {useEffect, useState} from "react";
import {useFieldArray, useForm} from "react-hook-form";
import themisApi from "../../../api/themisApi";
import type {SimStat} from "../../../types/themis";
import {publish} from "../../../utils/events";
import {PUBLISH_EVENT} from "../../common/NotificationSink";
import ImportSimStatsModal from "../form/ImportSimStatsModal";
import SimStatsEntryRow from "../form/SimStatsEntryRow";
import SimGraph from "../graph/SimGraph";
import type {UserDataTabPanelProps} from "./UserDataTabGroup";

const { Dragger } = Upload;

export type SimStatsFormData = {
  stats: SimStat[];
};

type InputStatistics = {
  resolved: Record<string, Record<string, number>>;
  created: Record<string, Record<string, number>>;
};

const buildEmptyForm = (year: string): SimStatsFormData => {
  const statisticsYear = DateTime.fromISO(year).startOf("year");

  return {
    stats: new Array(statisticsYear.weeksInWeekYear)
      .fill(0)
      .map((value, index) => {
        const currentDate = statisticsYear.set({ weekNumber: index });

        return {
          week: currentDate.weekNumber,
          created: {
            "1": 0,
            "2": 0,
            "3": 0,
            "4": 0,
            "5": 0,
            "99": 0,
            total: 0,
          },
          resolved: {
            "1": 0,
            "2": 0,
            "3": 0,
            "4": 0,
            "5": 0,
            "99": 0,
            total: 0,
          },
        };
      }),
  };
};

const SimStatsPanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [simStats, setSimStats] = useState<SimStat[] | undefined>([]);
  const [simStatsLoading, setSimStatsLoading] = useState(false);
  const [simStatsError, setSimStatsError] = useState(false);

  const { handleSubmit, control, register, reset, watch } =
    useForm<SimStatsFormData>({
      defaultValues: buildEmptyForm(year),
    });
  const { fields } = useFieldArray({
    control,
    name: "stats",
  });

  const statsWatch = watch("stats");

  const loadSimStats = async (quiet: boolean = false) => {
    if (!quiet) {
      setSimStatsLoading(true);
    }

    setSimStatsError(false);

    try {
      const response = await themisApi.getSimStats(username, year);
      setSimStats(response.stats);

      if (response.stats?.length > 50) {
        reset(response);
      }
    } catch (e) {
      setSimStatsError(true);
    } finally {
      setSimStatsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadSimStats(false);
    })();
  }, [username, year]);

  useEffect(() => {}, [statsWatch]);

  const onSubmit = async (data: SimStatsFormData) => {
    try {
      await themisApi.upsertSimStats(username, year, data.stats);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "SIM stats saved",
        description: "SIM statistics have been successfully saved",
      });

      await afterSave();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save SIM stats",
        description: "Unable to save SIM statistics due to a server error",
      });
    }
  };

  const processSimStats = (input?: string) => {
    if (!input) {
      throw "No input!";
    }

    const inputJson: InputStatistics = JSON.parse(input);
    const inputResolvedEntries = Object.entries(inputJson.resolved);
    const inputCreatedEntries = Object.entries(inputJson.created);
    const processedEntries: SimStat[] = new Array(
      Math.max(inputResolvedEntries.length, inputCreatedEntries.length),
    );

    inputResolvedEntries.forEach(([key, value]) => {
      const week = parseInt(key);
      processedEntries[week - 1] = {
        week: week,
        resolved: {
          "1": value["1"],
          "2": value["2"],
          "3": value["3"],
          "4": value["4"],
          "5": value["5"],
          "99": value["99"],
          total: value["total"],
        },
        created: {
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0,
          "5": 0,
          "99": 0,
          total: 0,
        },
      };
    });

    inputCreatedEntries.forEach(([key, value]) => {
      const week = parseInt(key);

      processedEntries[week - 1].created["1"] = value["1"];
      processedEntries[week - 1].created["2"] = value["2"];
      processedEntries[week - 1].created["3"] = value["3"];
      processedEntries[week - 1].created["4"] = value["4"];
      processedEntries[week - 1].created["5"] = value["5"];
      processedEntries[week - 1].created["99"] = value["99"];
      processedEntries[week - 1].created["total"] = value["total"];
    });

    return processedEntries;
  };

  const formRows = fields
    .sort((a, b) => {
      return a.week === b.week ? 0 : a.week - b.week > 0 ? 1 : -1;
    })
    .map((field, index) => {
      return (
        <SimStatsEntryRow
          week={field.week}
          index={index}
          control={control}
          register={register}
        />
      );
    });

  return (
    <Row>
      <Col span={24}>
        <Row gutter={8}>
          <Col span={24}>
            <Dragger
              height={120}
              style={{
                marginBottom: 16,
              }}
              showUploadList={false}
              maxCount={1}
              beforeUpload={async (file) => {
                try {
                  reset({ stats: processSimStats(await file.text()) });
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
          </Col>
          <Col span={12}>
            <SimGraph
              axisLabel={"Created"}
              data={statsWatch}
              year={year}
              stat={"created"}
              max={100}
              inferMax={true}
            />
          </Col>
          <Col span={12}>
            <SimGraph
              axisLabel={"Resolved"}
              data={statsWatch}
              year={year}
              stat={"resolved"}
              inferMax={true}
            />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={2}></Col>
          <Col span={22}>
            <Row gutter={8}>
              <Col span={12} style={{ textAlign: "center" }} className={"b-r1"}>
                <Typography.Text strong={true}>Created</Typography.Text>
              </Col>
              <Col span={12} style={{ textAlign: "center" }}>
                <Typography.Text strong={true}>Resolved</Typography.Text>
              </Col>
            </Row>
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={2} style={{ textAlign: "end" }} className={"b-b1"}>
            <Typography.Text strong={true} style={{ fontSize: 11 }}>
              Week
            </Typography.Text>
          </Col>
          <Col span={11}>
            <Row gutter={8}>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  1
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  2
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  3
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  4
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  5
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  99
                </Typography.Text>
              </Col>
              <Col
                span={6}
                style={{ textAlign: "center" }}
                className={"b-r1 b-b1"}
              >
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  Total
                </Typography.Text>
              </Col>
            </Row>
          </Col>
          <Col span={11}>
            <Row gutter={8}>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  1
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  2
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  3
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  4
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  5
                </Typography.Text>
              </Col>
              <Col span={3} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  99
                </Typography.Text>
              </Col>
              <Col span={6} style={{ textAlign: "center" }} className={"b-b1"}>
                <Typography.Text strong={true} style={{ fontSize: 11 }}>
                  Total
                </Typography.Text>
              </Col>
            </Row>
          </Col>
        </Row>
        {formRows}
        <Row gutter={8}>
          <Col span={6} offset={2} style={{ marginTop: 12 }}>
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
      <ImportSimStatsModal
        processStatsFunction={processSimStats}
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
export default SimStatsPanel;

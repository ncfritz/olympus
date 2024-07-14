import { Button, Col, Row, Slider, Space, Typography } from "antd";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import {
  type ForteSummary,
  LEADERSHIP_PRINCIPLES,
} from "../../../types/themis";
import { publish } from "../../../utils/events";
import { EMPTY_FORTE_SUMMARY } from "../../../utils/themisData";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import LeadershipPrinciplesGraph from "../graph/LeadershipPrinciplesGraph";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

export type ForteFormData = {
  summary: ForteSummary;
};

const FortePanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [forteSummary, setForteSummary] = useState<ForteSummary | undefined>(
    undefined,
  );
  const [forteSummaryLoading, setForteSummaryLoading] = useState(false);
  const [forteSummaryError, setForteSummaryError] = useState(false);

  const { handleSubmit, control, watch, reset, getValues } =
    useForm<ForteFormData>({ defaultValues: { summary: EMPTY_FORTE_SUMMARY } });
  const summaryWatch = watch("summary");

  const loadForteSummary = async (quiet: boolean = false) => {
    if (!quiet) {
      setForteSummaryLoading(true);
    }

    setForteSummaryError(false);

    try {
      const response = await themisApi.getForteSummary(username, year);
      setForteSummary(response.summary);
      reset(response);
    } catch (e) {
      setForteSummaryError(true);
    } finally {
      setForteSummaryLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadForteSummary(false);
    })();
  }, [username, year]);

  useEffect(() => {
    setForteSummary(summaryWatch);
  }, [summaryWatch]);

  const onSubmit = async (data: ForteFormData) => {
    try {
      await themisApi.upsertForteSummary(username, year, data.summary);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Forte summary saved",
        description: "Forte summary has been successfully saved",
      });

      await afterSave();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save Forte summary",
        description: "Unable to save Forte summary due to a server error",
      });
    }
  };

  return (
    <Space direction={"vertical"} size={16} style={{ width: "100%" }}>
      <Row>
        <Col span={10}>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={10} style={{ textAlign: "end" }}>
              <Typography.Text strong={true} style={{ fontSize: 12 }}>
                Leadership Principle
              </Typography.Text>
            </Col>
            <Col span={7} style={{ textAlign: "end" }}>
              <Typography.Text strong={true} style={{ fontSize: 12 }}>
                Growth Opportunity
              </Typography.Text>
            </Col>
            <Col span={7}>
              <Typography.Text strong={true} style={{ fontSize: 12 }}>
                Super Power
              </Typography.Text>
            </Col>
          </Row>
          {Object.entries(LEADERSHIP_PRINCIPLES).map(([key, value]) => {
            return (
              <Row gutter={12}>
                <Col span={10} style={{ textAlign: "end", fontSize: 10 }}>
                  {value}
                </Col>
                <Col span={7}>
                  <Controller
                    name={`summary.${key as keyof ForteSummary}.opportunity`}
                    control={control}
                    render={({ field }: { field: any }) => (
                      <Slider {...field} reverse={true} min={0} max={20} />
                    )}
                  />
                </Col>
                <Col span={7}>
                  <Controller
                    name={`summary.${key as keyof ForteSummary}.strength`}
                    control={control}
                    render={({ field }: { field: any }) => (
                      <Slider {...field} min={0} max={20} />
                    )}
                  />
                </Col>
              </Row>
            );
          })}
          <Row style={{ marginTop: 12 }}>
            <Col offset={10} span={12}>
              <Button
                type={"primary"}
                onClick={() => {
                  handleSubmit(onSubmit)();
                }}
              >
                Save
              </Button>
            </Col>
          </Row>
        </Col>
        <Col span={12}>
          <Space
            direction={"vertical"}
            size={16}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Typography.Text strong={true} style={{ fontSize: 12 }}>
              Strengths
            </Typography.Text>
            <LeadershipPrinciplesGraph
              data={{ [year]: forteSummary || EMPTY_FORTE_SUMMARY }}
              type={"strengths"}
            />
            <Typography.Text strong={true} style={{ fontSize: 12 }}>
              Growth Opportunities
            </Typography.Text>
            <LeadershipPrinciplesGraph
              data={{ [year]: forteSummary || EMPTY_FORTE_SUMMARY }}
              type={"opportunities"}
            />
          </Space>
        </Col>
      </Row>
    </Space>
  );
};
export default FortePanel;

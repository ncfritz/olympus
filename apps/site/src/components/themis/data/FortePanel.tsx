import { InboxOutlined } from "@ant-design/icons";
import { Button, Col, Row, Slider, Space, Typography, Upload } from "antd";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import {
  type ForteResult,
  type ForteSummary,
  LEADERSHIP_PRINCIPLES,
} from "../../../types/themis";
import { publish } from "../../../utils/events";
import { EMPTY_FORTE_SUMMARY } from "../../../utils/themisData";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import ImportForteHistoryModal from "../form/ImportForteHistoryModal";
import LeadershipPrinciplesGraph from "../graph/LeadershipPrinciplesGraph";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

const { Dragger } = Upload;

export type ForteFormData = {
  summary: ForteSummary;
};

const FortePanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false);
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

  const updateSummary = (
    toUpdate: ForteSummary,
    growthArea: boolean,
    lp: string,
  ) => {
    let keyToUpdate: keyof ForteSummary | undefined = undefined;
    const measure: keyof ForteResult = growthArea ? "opportunity" : "strength";

    switch (lp) {
      case "CUSTOMER_OBSESSION":
        keyToUpdate = "customerObsession";
        break;
      case "OWNERSHIP":
        keyToUpdate = "ownership";
        break;
      case "INVENT_AND_SIMPLIFY":
        keyToUpdate = "inventSimplify";
        break;
      case "ARE_RIGHT_A_LOT":
        keyToUpdate = "areRightALot";
        break;
      case "LEARN_AND_BE_CURIOUS":
        keyToUpdate = "learnBeCurious";
        break;
      case "HIRE_AND_DEVELOP_THE_BEST":
        keyToUpdate = "hireDevelop";
        break;
      case "INSIST_ON_THE_HIGHEST_STANDARDS":
        keyToUpdate = "insistHighestStandards";
        break;
      case "THINK_BIG":
        keyToUpdate = "thinkBig";
        break;
      case "BIAS_FOR_ACTION":
        keyToUpdate = "biasForAction";
        break;
      case "FRUGALITY":
        keyToUpdate = "frugality";
        break;
      case "EARN_TRUST":
        keyToUpdate = "earnTrust";
        break;
      case "DIVE_DEEP":
        keyToUpdate = "diveDeep";
        break;
      case "HAVE_BACKBONE_DISAGREE_AND_COMMIT":
        keyToUpdate = "backbone";
        break;
      case "DELIVER_RESULTS":
        keyToUpdate = "deliverResults";
        break;
      case "STRIVE_TO_BE_EARTHS_BEST_EMPLOYER":
        keyToUpdate = "bestEmployer";
        break;
      case "SUCCESS_AND_SCALE_BRING_GREAT_RESPONSIBILITY":
        keyToUpdate = "successScale";
        break;
      default:
        console.log(lp);
    }

    if (keyToUpdate) {
      toUpdate[keyToUpdate][measure]++;
    }
  };

  const processForte = (input?: string) => {
    if (!input) {
      throw "No input!";
    }

    const parsedSummary: ForteSummary = JSON.parse(
      JSON.stringify(EMPTY_FORTE_SUMMARY),
    );
    const parsedInput = JSON.parse(input!);
    const feedback = parsedInput.feedbackList;

    feedback.forEach((feedbackItem: any) => {
      const attributes = JSON.parse(feedbackItem.attributes);

      if (attributes.feedback?.growthLeadershipPrinciples?.length > 0) {
        attributes.feedback.growthLeadershipPrinciples.forEach((lp: string) => {
          updateSummary(parsedSummary, true, lp);
        });
      }

      if (attributes.feedback?.leadershipPrinciples?.length > 0) {
        attributes.feedback.leadershipPrinciples.forEach((lp: string) => {
          updateSummary(parsedSummary, false, lp);
        });
      }
    });

    return parsedSummary;
  };

  return (
    <Space direction={"vertical"} size={16} style={{ width: "100%" }}>
      <Row gutter={16}>
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
              <Space direction={"horizontal"} size={8}>
                <Button
                  type={"primary"}
                  onClick={() => {
                    handleSubmit(onSubmit)();
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
                reset({ summary: processForte(await file.text()) });
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
        <ImportForteHistoryModal
          processForteFunction={processForte}
          isOpen={importModalOpen}
          importFunction={async (summary) => {
            reset({ summary: summary });
          }}
          onClose={() => {
            setImportModalOpen(false);
          }}
        />
      </Row>
    </Space>
  );
};
export default FortePanel;

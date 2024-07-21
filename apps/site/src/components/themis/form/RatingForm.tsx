import { Col, Row, Typography, Select, Button } from "antd";
import { useForm, Controller } from "react-hook-form";
import { useState } from "react";
import themisApi from "../../../api/themisApi";
import type { ReviewRating } from "../../../types/themis";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import Potential from "../rating/GrowthPotential";
import Overall from "../rating/Overall";
import Performance from "../rating/Performance";

export interface RatingFormProps {
  username: string;
  year: string;
  onUpdateSuccess?: (data: ReviewRating) => Promise<void>;
  onCancel?: () => void;
  existingRating?: ReviewRating;
}

const RatingForm: React.FunctionComponent<RatingFormProps> = ({
  username,
  year,
  onUpdateSuccess,
  onCancel,
  existingRating = {
    performance: "Unknown",
    growth: "Unknown",
    overall: "Unknown",
  },
}) => {
  const { control, handleSubmit, watch } = useForm<ReviewRating>({
    defaultValues: {
      performance: existingRating.performance,
      growth: existingRating.growth,
      overall: existingRating.overall,
    },
  });

  const [status, setStatus] = useState("");
  const overallWatch = watch("overall");
  const performanceWatch = watch("performance");
  const growthWatch = watch("growth");

  const onSubmit = async (data: ReviewRating) => {
    try {
      await themisApi.upsertRating(username, year, data);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Rating saved",
        description: "The rating has been successfully saved",
      });

      if (onUpdateSuccess) {
        await onUpdateSuccess(data);
      }
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save rating",
        description: "Unable to save rating due to a server error",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Row
        gutter={8}
        style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
      >
        <Col span={3}>
          <Typography.Text
            strong={true}
            style={{ display: "flex", justifyContent: "end" }}
          >
            Performance
          </Typography.Text>
        </Col>
        <Col span={4}>
          <Controller
            name="performance"
            control={control}
            render={({ field }: { field: any }) => (
              <Select
                {...field}
                style={{ width: "100%" }}
                options={[
                  { value: "NA", label: "Not Available" },
                  { value: "NI1", label: "Needs Improvement (1)" },
                  { value: "NI2", label: "Needs Improvement (2)" },
                  { value: "NI3", label: "Needs Improvement (3)" },
                  { value: "M1", label: "Meets (4)" },
                  { value: "M2", label: "Meets (5)" },
                  { value: "E1", label: "Exceeds (6)" },
                  { value: "E2", label: "Exceeds (7)" },
                ]}
              />
            )}
          />
        </Col>
        <Col span={2}>
          <Performance rating={performanceWatch} size={"small"} />
        </Col>
      </Row>
      <Row
        gutter={8}
        style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
      >
        <Col span={3}>
          <Typography.Text
            strong={true}
            style={{ display: "flex", justifyContent: "end" }}
          >
            Growth Potential
          </Typography.Text>
        </Col>
        <Col span={4}>
          <Controller
            name="growth"
            control={control}
            render={({ field }: { field: any }) => (
              <Select
                {...field}
                style={{ width: "100%" }}
                options={[
                  { value: "NA", label: "Not Available" },
                  { value: "L", label: "Low" },
                  { value: "M", label: "Medium" },
                  { value: "H", label: "High" },
                  { value: "VH", label: "Very High" },
                ]}
              />
            )}
          />
        </Col>
        <Col span={2}>
          <Potential rating={growthWatch} size={"small"} />
        </Col>
      </Row>
      <Row
        gutter={8}
        style={{ display: "flex", alignItems: "center", marginBottom: 8 }}
      >
        <Col span={3}>
          <Typography.Text
            strong={true}
            style={{ display: "flex", justifyContent: "end" }}
          >
            Overall
          </Typography.Text>
        </Col>
        <Col span={4}>
          <Controller
            name="overall"
            control={control}
            render={({ field }: { field: any }) => (
              <Select
                {...field}
                style={{ width: "100%" }}
                options={[
                  { value: "NA", label: "Not Available" },
                  { value: "LE", label: "LE - Low" },
                  { value: "HV1", label: "HV1 - Medium" },
                  { value: "HV2", label: "HV2 - High" },
                  { value: "HV3", label: "HV3 - Very High" },
                  { value: "TT", label: "TT - Top Tier" },
                ]}
              />
            )}
          />
        </Col>
        <Col span={2}>
          <Overall rating={overallWatch} size={"small"} />
        </Col>
      </Row>
      <Row style={{ display: "flex", alignItems: "center" }}>
        <Col offset={3} span={6}>
          <Button
            type={"primary"}
            htmlType={"submit"}
            disabled={status === "saving"}
            style={{ marginRight: 8 }}
          >
            Save
          </Button>
          {onCancel && (
            <Button
              type={"primary"}
              danger={true}
              onClick={onCancel}
              disabled={status === "saving"}
            >
              Cancel
            </Button>
          )}
        </Col>
      </Row>
    </form>
  );
};
export default RatingForm;

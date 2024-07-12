import { ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Result, Space, Spin } from "antd";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import type { ReviewRating } from "../../../types/themis";
import RatingForm from "../form/RatingForm";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

const RatingPanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [rating, setRating] = useState<ReviewRating | undefined>(undefined);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState(false);

  const loadRating = async (quiet: boolean = false) => {
    if (!quiet) {
      setRatingLoading(true);
    }

    setRatingError(false);

    try {
      const response = await themisApi.getRating(username, year);
      setRating(response.rating);
    } catch (e) {
      setRatingError(true);
    } finally {
      setRatingLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadRating(false);
    })();
  }, [username, year]);

  let content;

  if (ratingLoading) {
    content = (
      <Space
        style={{
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin size={"small"} />
      </Space>
    );
  } else if (ratingError) {
    content = (
      <Result
        status={"error"}
        subTitle={"Unable to retrieve rating"}
        extra={[
          <Button
            type={"primary"}
            icon={<ReloadOutlined />}
            onClick={async () => {
              await loadRating(false);
            }}
          >
            Refresh
          </Button>,
        ]}
      />
    );
  } else {
    content = (
      <RatingForm
        username={username}
        year={year}
        existingRating={rating}
        onUpdateSuccess={async () => {
          await loadRating(true);
          await afterSave();
        }}
      />
    );
  }

  return content;
};
export default RatingPanel;

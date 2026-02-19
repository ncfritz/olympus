import { Button, Space, Typography } from "antd";
import type { ReactNode } from "react";
import {
  type DionysusMediaAssetSearchPayload,
  NotificationFormatter,
} from "../interfaces";

export class MediaAssetSearchRefreshCompletionFormatter implements NotificationFormatter<DionysusMediaAssetSearchPayload> {
  format(
    payload: DionysusMediaAssetSearchPayload,
  ): [string | ReactNode, string | ReactNode] {
    const title = (
      <Typography.Text>A metadata workflow has completed</Typography.Text>
    );

    const message = (
      <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
        <Typography.Text>A search configuration has succesfully refreshed</Typography.Text>
      </Space>
    );

    return [title, message];
  }
}

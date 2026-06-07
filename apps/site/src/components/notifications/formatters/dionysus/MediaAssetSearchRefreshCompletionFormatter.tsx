import { Space, Typography } from "antd";
import type { ReactNode } from "react";
import { Events, publish } from "../../../../utils/events";
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
      <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
        <Typography.Text>
          A search configuration has successfully refreshed.
        </Typography.Text>
      </Space>
    );

    publish(Events.DIONYSYS_MEDIA_SEARCH_COMPLETE, payload);

    return [title, message];
  }
}

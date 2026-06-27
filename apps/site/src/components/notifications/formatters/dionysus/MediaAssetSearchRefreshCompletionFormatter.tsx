import { Button, Space, Typography } from "antd";
import type { ReactNode } from "react";
import { Events, publish } from "../../../../utils/events";
import { getPoster } from "../../../dionysus/metadata/util";
import {
  type DionysusMediaAssetSearchPayload,
  NotificationFormatter,
} from "../interfaces";

export class MediaAssetSearchRefreshCompletionFormatter implements NotificationFormatter<DionysusMediaAssetSearchPayload> {
  format(
    payload: DionysusMediaAssetSearchPayload,
  ): [string | ReactNode, string | ReactNode] {
    const title = <Typography.Text>Media Search Completed</Typography.Text>;
    let link;

    if (payload.assetType === "movie") {
      link = `/dionysus/movies/${payload.mediaId}`;
    } else if (payload.assetType === "tv_series") {
      link = `/dionysus/tv/series/${payload.media.seriesId}`;
    } else if (payload.assetType === "tv_season") {
      link = `/dionysus/tv/series/${payload.media.seriesId}/season/${payload.media.seasonNumber}`;
    } else if (payload.assetType === "tv_episode") {
      link = `/dionysus/tv/series/${payload.media.seriesId}/season/${payload.media.seasonNumber}/episode/${payload.media.episodeNumber}`;
    }

    const message = (
      <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
        <Space
          orientation={"horizontal"}
          size={8}
          style={{ alignItems: "start", width: "100%" }}
          className={"person-fix"}
        >
          {getPoster(payload.media.posterPath, "vertical", 90, 4)}
          <Space
            orientation={"vertical"}
            size={0}
            style={{
              width: "100%",
              justifyContent: "space-between",
              display: "flex",
              height: 90,
            }}
          >
            <Space
              orientation={"vertical"}
              size={0}
              style={{ width: "100%" }}
              styles={{ item: { lineHeight: "11px" } }}
            >
              <Typography.Text strong={true} style={{ fontSize: "12px" }}>
                {payload.assetType === "movie"
                  ? payload.media.name
                  : payload.media.seriesName}
              </Typography.Text>
              {["tv_season", "tv_episode"].includes(payload.assetType) &&
                payload.media.seasonNumber && (
                  <Typography.Text style={{ fontSize: "11px" }}>
                    Season {payload.media.seasonNumber}
                  </Typography.Text>
                )}
              {payload.assetType === "tv_episode" &&
                payload.media.episodeNumber && (
                  <Typography.Text style={{ fontSize: "11px" }}>
                    Episode {payload.media.episodeNumber}: {payload.media.name}
                  </Typography.Text>
                )}
            </Space>
            <Button
              color={"default"}
              variant={"filled"}
              size={"small"}
              block={true}
              href={`${link}?tab=sr`}
            >
              View Results
            </Button>
          </Space>
        </Space>
      </Space>
    );

    publish(Events.DIONYSUS_MEDIA_SEARCH_COMPLETE, payload);

    return [title, message];
  }
}

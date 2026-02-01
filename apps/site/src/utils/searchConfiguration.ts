import type {
  MediaAssetSearchConfiguration,
  MediaAssetSearchType,
} from "@ncfritz/olympus-sdk/dionysus";
import mediaApi from "../api/mediaApi";
import { PUBLISH_EVENT } from "../components/common/NotificationSink";
import { publish } from "./events";

export type SearchConfigurationIdentifiers = {
  mediaId: number;
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export const handleCreateSearchConfiguration = async (
  mediaType: MediaAssetSearchType,
  ids: SearchConfigurationIdentifiers,
  afterUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>,
) => {
  try {
    const response = await mediaApi.createMediaAssetSearchConfiguration({
      type: mediaType,
      mediaId: ids.mediaId,
      backoff: 24,
      jitter: 300,
      enabled: true,
      seriesId: ids.seriesId,
      seasonNumber: ids.seasonNumber,
      episodeNumber: ids.episodeNumber,
    });

    if (afterUpdate) {
      await afterUpdate(response.data.searchConfiguration);
    }

    publish(PUBLISH_EVENT, {
      type: "success",
      message: "Search Configuration created",
      description: "The Search Configuration has been created successfully",
    });
  } catch (e) {
    publish(PUBLISH_EVENT, {
      type: "error",
      message: "Unable to create Search Configuration",
      description: "The request to create a Search Configuration failed",
    });
  }
};

export const handleSetEnabled = async (
  mediaType: MediaAssetSearchType,
  mediaId: number,
  enabled: boolean,
  afterUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>,
) => {
  try {
    const response = await mediaApi.updateMediaAssetSearchConfiguration(
      mediaType,
      mediaId,
      {
        enabled: enabled,
      },
    );

    if (afterUpdate) {
      await afterUpdate(response.data.searchConfiguration);
    }

    publish(PUBLISH_EVENT, {
      type: "success",
      message: "Search Configuration updated",
      description: `The Search Configuration has been ${enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (e) {
    publish(PUBLISH_EVENT, {
      type: "error",
      message: "Unable to update Search Configuration",
      description: "The request to update the Search Configuration failed",
    });
  }
};

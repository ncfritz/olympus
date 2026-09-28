import type {
  MediaAssetSearchConfiguration,
  MediaAssetSearchType,
} from "@ncfritz/olympus-sdk/dionysus";
import mediaApi from "../api/mediaApi";
import { Events, publish } from "./events";

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
      status: "ok",
      seriesId: ids.seriesId,
      seasonNumber: ids.seasonNumber,
      episodeNumber: ids.episodeNumber,
    });

    if (afterUpdate) {
      await afterUpdate(response.data.searchConfiguration);
    }

    publish(
      Events.DIONYSUS_MEDIA_SEARCH_CONFIGURATION_UPDATED,
      response.data.searchConfiguration,
    );
    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
      type: "success",
      message: "Search Configuration created",
      description: "The Search Configuration has been created successfully",
    });
  } catch (e) {
    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
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
  recursive: boolean,
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

    publish(
      Events.DIONYSUS_MEDIA_SEARCH_CONFIGURATION_UPDATED,
      response.data.searchConfiguration,
    );

    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
      type: "success",
      message: "Search Configuration updated",
      description: `The Search Configuration has been ${enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (e) {
    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
      type: "error",
      message: "Unable to update Search Configuration",
      description: "The request to update the Search Configuration failed",
    });
  }
};

export const handleTriggerSearch = async (
  mediaType: MediaAssetSearchType,
  mediaId: number,
  afterUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>,
) => {
  try {
    const response = await mediaApi.triggerMediaAssetSearch(mediaType, mediaId);

    if (afterUpdate) {
      await afterUpdate(response.data.searchConfiguration);
    }

    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
      type: "success",
      message: "Search Triggered",
      description: `The Search has been successfully triggered. There will be a notification once the search 
        execution completes.`,
    });
  } catch (e) {
    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
      type: "error",
      message: "Unable to trigger search",
      description: "The request to trigger the search failed",
    });
  }
};

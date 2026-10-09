import {
  EyeFilled,
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type {
  BaseTvSeries,
  MediaAssetSearchConfiguration,
} from "@ncfritz/olympus-sdk/dionysus";
import { List, Space, Spin } from "antd";
import Link from "next/link";
import React, { type MouseEventHandler, useEffect, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import mediaApi from "../../../api/mediaApi";
import { Events, publish, subscribe, unsubscribe } from "../../../utils/events";
import {
  handleCreateSearchConfiguration,
  handleSetEnabled,
} from "../../../utils/searchConfiguration";
import TvSeriesPosterCard from "./TvSeriesPosterCard";

export interface TvSeriesListProps {
  tvSeries: BaseTvSeries[];
  loading: boolean;
  showStatus?: boolean;
  columns?: number;
  bordered?: boolean;
  afterSearchUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>;
  scrollOptions?: {
    fetchNextPage: () => Promise<void>;
    itemCount: number;
    target?: string;
  };
}

export interface TvSeriesListItemProps {
  item: BaseTvSeries;
  bordered?: boolean;
  showStatus?: boolean;
  afterSearchUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>;
  afterFavoriteUpdate?: (favorite: boolean) => Promise<void>;
}

const TvSeriesListItem: React.FunctionComponent<TvSeriesListItemProps> = ({
  item,
  bordered,
  showStatus,
  afterSearchUpdate,
  afterFavoriteUpdate,
}) => {
  const [searchConfigurationUpdating, setSearchConfigurationUpdating] =
    useState(false);
  const [favoriteUpdating, setFavoriteUpdating] = useState(false);
  const [searchConfiguration, setSearchConfiguration] = useState(
    item.searchConfiguration,
  );
  const [favorite, setFavorite] = useState(item.favorite !== undefined);

  useEffect(() => {
    setSearchConfiguration(item.searchConfiguration);
  }, [item]);

  useEffect(() => {
    subscribe(
      Events.DIONYSUS_MEDIA_SEARCH_CONFIGURATION_UPDATED,
      onSearchConfigurationUpdated,
    );
    subscribe(Events.DIONYSUS_MEDIA_FAVORITE_UPDATED, onFavoriteUpdated);

    return () => {
      unsubscribe(
        Events.DIONYSUS_MEDIA_SEARCH_CONFIGURATION_UPDATED,
        onSearchConfigurationUpdated,
      );
      unsubscribe(Events.DIONYSUS_MEDIA_FAVORITE_UPDATED, onFavoriteUpdated);
    };
  }, []);

  const onSearchConfigurationUpdated = (e: CustomEvent) => {
    if (e.detail.type === "tv_series" && e.detail.mediaId === item.id) {
      console.log("Updated search configuration", e.detail);
      setSearchConfiguration(e.detail);
    }
  };

  let searchAction: MouseEventHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setSearchConfigurationUpdating(true);

      await handleCreateSearchConfiguration(
        "tv_series",
        { mediaId: item.id },
        afterSearchUpdate,
      );
    } finally {
      setSearchConfigurationUpdating(false);
    }
  };

  if (searchConfiguration) {
    searchAction = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        setSearchConfigurationUpdating(true);
        await handleSetEnabled(
          "tv_series",
          item.id,
          !searchConfiguration!.enabled,
          true,
          afterSearchUpdate,
        );
      } finally {
        setSearchConfigurationUpdating(false);
      }
    };
  }

  let searchActionIcon;

  if (searchConfigurationUpdating) {
    searchActionIcon = <LoadingOutlined />;
  } else if (item.searchConfiguration && item.searchConfiguration.enabled) {
    searchActionIcon = (
      <EyeFilled onClick={searchAction} style={{ color: "#478133" }} />
    );
  } else if (item.searchConfiguration) {
    searchActionIcon = (
      <EyeFilled onClick={searchAction} style={{ color: "#bd931d" }} />
    );
  } else {
    searchActionIcon = <EyeOutlined onClick={searchAction} />;
  }

  const onFavoriteUpdated = (e: CustomEvent) => {
    if (e.detail.type === "tv_series" && e.detail.mediaId === item.id) {
      setFavorite(e.detail);
    }
  };

  const favoriteAction: MouseEventHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setFavoriteUpdating(true);

      if (favorite) {
        await mediaApi.deleteMediaFavorite("tv_series", item.id);
      } else {
        await mediaApi.createMediaFavorite("tv_series", item.id);
      }

      if (afterFavoriteUpdate) {
        await afterFavoriteUpdate(!favorite);
      }

      publish(Events.DIONYSUS_MEDIA_FAVORITE_UPDATED, !favorite);

      setFavorite(!favorite);
    } finally {
      setFavoriteUpdating(false);
    }
  };

  let favoriteIcon;

  if (favoriteUpdating) {
    favoriteIcon = <LoadingOutlined />;
  } else if (favorite) {
    favoriteIcon = (
      <HeartFilled
        style={{ color: favorite ? "#ff4d4f" : undefined }}
        onClick={favoriteAction}
      />
    );
  } else {
    favoriteIcon = <HeartOutlined onClick={favoriteAction} />;
  }

  const listItem = (
    <Link href={`/dionysus/tv/series/${item.id}`}>
      <TvSeriesPosterCard
        tvSeries={item}
        showStatus={showStatus}
        showTitle={true}
        hoverable={false}
        className={"compact"}
        bordered={bordered}
        enablePopover={true}
        actions={[favoriteIcon, searchActionIcon]}
      />
    </Link>
  );

  return <List.Item>{listItem}</List.Item>;
};

const TvSeriesList: React.FunctionComponent<TvSeriesListProps> = ({
  tvSeries,
  loading,
  showStatus = true,
  columns = 12,
  bordered = true,
  afterSearchUpdate,
  scrollOptions,
}: TvSeriesListProps) => {
  let content: React.ReactNode;

  const listContent = (
    <List
      grid={{ gutter: 16, column: columns }}
      dataSource={tvSeries}
      loading={loading}
      renderItem={(item) => {
        return (
          <TvSeriesListItem
            item={item}
            showStatus={showStatus}
            bordered={bordered}
            afterSearchUpdate={afterSearchUpdate}
          />
        );
      }}
    />
  );

  if (scrollOptions) {
    content = (
      <InfiniteScroll
        scrollableTarget={scrollOptions.target}
        style={{ overflow: "inherit" }}
        dataLength={tvSeries.length}
        next={scrollOptions.fetchNextPage}
        hasMore={scrollOptions.itemCount > tvSeries.length}
        loader={
          <Space style={{ width: "100%", justifyContent: "center" }}>
            <Spin />
          </Space>
        }
      >
        {listContent}
      </InfiniteScroll>
    );
  } else {
    content = listContent;
  }

  return content;
};
export default TvSeriesList;

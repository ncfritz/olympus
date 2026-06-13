import {
  EyeFilled,
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import { List, Space, Spin } from "antd";
import Link from "next/link";
import React, {
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import mediaApi from "../../../api/mediaApi";
import { Events, publish, subscribe, unsubscribe } from "../../../utils/events";
import {
  handleCreateSearchConfiguration,
  handleSetEnabled,
} from "../../../utils/searchConfiguration";
import MoviePosterCard from "./MoviePosterCard";

export interface MovieListProps {
  movies: SparseMovie[];
  loading: boolean;
  showReleaseYear?: boolean;
  showReleaseStatus?: boolean;
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
  style?: CSSProperties;
}

interface MovieListItemProps {
  item: SparseMovie;
  bordered?: boolean;
  showReleaseYear?: boolean;
  showReleaseStatus?: boolean;
  afterSearchUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>;
  afterFavoriteUpdate?: (favorite: boolean) => Promise<void>;
}

const MovieListItem: React.FunctionComponent<MovieListItemProps> = ({
  item,
  bordered,
  showReleaseYear,
  showReleaseStatus,
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
    if (e.detail.type === "movie" && e.detail.mediaId === item.id) {
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
        "movie",
        { mediaId: item.id },
        afterSearchUpdate,
      );
    } finally {
      setSearchConfigurationUpdating(false);
    }
  };

  if (item.searchConfiguration) {
    searchAction = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        setSearchConfigurationUpdating(true);
        await handleSetEnabled(
          "movie",
          item.id,
          !searchConfiguration!.enabled,
          false,
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
  } else if (searchConfiguration && searchConfiguration.enabled) {
    searchActionIcon = <EyeFilled onClick={searchAction} />;
  } else {
    searchActionIcon = <EyeOutlined onClick={searchAction} />;
  }

  const onFavoriteUpdated = (e: CustomEvent) => {
    if (e.detail.type === "movie" && e.detail.mediaId === item.id) {
      setFavorite(e.detail);
    }
  };

  const favoriteAction: MouseEventHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setFavoriteUpdating(true);

      if (favorite) {
        await mediaApi.deleteMediaFavorite("movie", item.id);
      } else {
        await mediaApi.createMediaFavorite("movie", item.id);
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
    <Link href={`/dionysus/movies/${item.id}`}>
      <MoviePosterCard
        movie={item}
        showReleaseYear={showReleaseYear}
        showReleaseStatus={showReleaseStatus}
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

const MovieList: React.FunctionComponent<MovieListProps> = ({
  movies,
  loading,
  showReleaseYear = true,
  showReleaseStatus = true,
  columns = 12,
  bordered = true,
  afterSearchUpdate,
  scrollOptions,
  style,
}: MovieListProps) => {
  let content: ReactNode;
  const listContent = (
    <List
      grid={{ gutter: 16, column: columns }}
      dataSource={movies}
      loading={loading}
      renderItem={(item) => {
        return (
          <MovieListItem
            item={item}
            showReleaseYear={showReleaseYear}
            showReleaseStatus={showReleaseStatus}
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
        dataLength={movies.length}
        next={scrollOptions.fetchNextPage}
        hasMore={scrollOptions.itemCount > movies.length}
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
export default MovieList;

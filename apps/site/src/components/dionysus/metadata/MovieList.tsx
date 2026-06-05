import {
  EyeFilled,
  EyeOutlined,
  HeartOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import { List, Space, Spin } from "antd";
import Link from "next/link";
import {
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  useState,
} from "react";
import InfiniteScroll from "react-infinite-scroll-component";
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
}

const MovieListItem: React.FunctionComponent<MovieListItemProps> = ({
  item,
  bordered,
  showReleaseYear,
  showReleaseStatus,
  afterSearchUpdate,
}) => {
  const [updating, setUpdating] = useState(false);

  let searchAction: MouseEventHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setUpdating(true);

      await handleCreateSearchConfiguration(
        "movie",
        { mediaId: item.id },
        afterSearchUpdate,
      );
    } finally {
      setUpdating(false);
    }
  };

  if (item.searchConfiguration) {
    searchAction = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        setUpdating(true);
        await handleSetEnabled(
          "movie",
          item.id,
          !item.searchConfiguration!.enabled,
          false,
          afterSearchUpdate,
        );
      } finally {
        setUpdating(false);
      }
    };
  }

  let searchActionIcon;

  if (updating) {
    searchActionIcon = <LoadingOutlined />;
  } else if (item.searchConfiguration && item.searchConfiguration.enabled) {
    searchActionIcon = <EyeFilled onClick={searchAction} />;
  } else {
    searchActionIcon = <EyeOutlined onClick={searchAction} />;
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
        actions={[
          <HeartOutlined
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />,
          searchActionIcon,
        ]}
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

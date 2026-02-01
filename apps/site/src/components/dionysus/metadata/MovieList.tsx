import {
  CheckCircleFilled,
  EyeFilled,
  EyeOutlined,
  HeartOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  SparseMovie,
} from "@ncfritz/olympus-sdk/dionysus";
import { Badge, List } from "antd";
import Link from "next/link";
import { type MouseEventHandler, useState } from "react";
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

  let listItem = (
    <Link href={`/dionysus/movies/${item.id}`}>
      <MoviePosterCard
        movie={item}
        showReleaseYear={showReleaseYear}
        showReleaseStatus={showReleaseStatus}
        showTitle={true}
        hoverable={false}
        className={"compact"}
        bordered={bordered}
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

  // TODO: Replace with property when available
  if (true) {
    listItem = (
      <Badge.Ribbon
        color={"#478133"}
        style={{ fontSize: "12px" }}
        text={<CheckCircleFilled />}
      >
        {listItem}
      </Badge.Ribbon>
    );
  }

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
}: MovieListProps) => {
  return (
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
};
export default MovieList;

import {
  CheckCircleFilled,
  EyeFilled,
  EyeOutlined,
  HeartOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type {
  BaseTvSeries,
  MediaAssetSearchConfiguration,
} from "@ncfritz/olympus-sdk/dionysus";
import { Badge, List } from "antd";
import Link from "next/link";
import { type MouseEventHandler, useState } from "react";
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
}

export interface TvSeriesListItemProps {
  item: BaseTvSeries;
  bordered?: boolean;
  showStatus?: boolean;
  afterSearchUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>;
}

const TvSeriesListItem: React.FunctionComponent<TvSeriesListItemProps> = ({
  item,
  bordered,
  showStatus,
  afterSearchUpdate,
}) => {
  const [updating, setUpdating] = useState(false);

  let searchAction: MouseEventHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setUpdating(true);

      await handleCreateSearchConfiguration(
        "tv_series",
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
          "tv_series",
          item.id,
          !item.searchConfiguration!.enabled,
          true,
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

  let listItem = (
    <Link href={`/dionysus/tv/series/${item.id}`}>
      <TvSeriesPosterCard
        tvSeries={item}
        showStatus={showStatus}
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

const TvSeriesList: React.FunctionComponent<TvSeriesListProps> = ({
  tvSeries,
  loading,
  showStatus = true,
  columns = 12,
  bordered = true,
  afterSearchUpdate,
}: TvSeriesListProps) => {
  return (
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
};
export default TvSeriesList;

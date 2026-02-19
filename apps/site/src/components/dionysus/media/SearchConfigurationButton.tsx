import {
  CaretRightOutlined,
  CloseOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EyeFilled,
  EyeOutlined,
  PauseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type {
  MediaAssetSearchConfiguration,
  MediaAssetSearchType,
} from "@ncfritz/olympus-sdk/dionysus";
import { Badge, Button, Popover, Space } from "antd";
import * as React from "react";
import { useRef, useState } from "react";
import {
  handleCreateSearchConfiguration,
  handleSetEnabled,
  handleTriggerSearch,
} from "../../../utils/searchConfiguration";

export type SearchConfigurationButtonProps = {
  mediaType: MediaAssetSearchType;
  mediaId: number;
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  loading: boolean;
  searchConfiguration?: MediaAssetSearchConfiguration;
  afterUpdate?: (
    searchConfiguration: MediaAssetSearchConfiguration,
  ) => Promise<void>;
  className?: string;
};

const SearchConfigurationButton: React.FunctionComponent<
  SearchConfigurationButtonProps
> = ({
  mediaType,
  mediaId,
  seriesId,
  seasonNumber,
  episodeNumber,
  searchConfiguration,
  loading,
  afterUpdate,
  className,
}: SearchConfigurationButtonProps) => {
  const buttonRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [configUpdating, setconfigUpdating] = useState(false);

  const closeMenu = () => {
    setOpen(false);
  };

  const updateSearchConfiguration = async (recursive: boolean) => {
    if (!searchConfiguration) {
      return;
    }

    try {
      setconfigUpdating(true);
      closeMenu();
      await handleSetEnabled(
        mediaType,
        mediaId,
        !searchConfiguration.enabled,
        recursive,
        afterUpdate,
      );
    } finally {
      setconfigUpdating(false);
    }
  };

  let searchButton = (
    <Button
      className={`dionysus-action-button ${className}`}
      shape={"circle"}
      size={"large"}
      icon={<EyeOutlined />}
      loading={loading || configUpdating}
      onClick={async () => {
        try {
          setconfigUpdating(true);
          closeMenu();
          await handleCreateSearchConfiguration(
            mediaType,
            {
              mediaId: mediaId,
              seriesId: seriesId,
              seasonNumber: seasonNumber,
              episodeNumber: episodeNumber,
            },
            afterUpdate,
          );
        } finally {
          setconfigUpdating(false);
        }
      }}
    />
  );

  if (searchConfiguration) {
    const classNames = ["dionysus-action-button", className, "active"];
    let badgeIcon = <CaretRightOutlined style={{ color: "#ffffff" }} />;
    let badgeColor = "#488633";

    if (open) {
      classNames.push("no-hover");
    }

    if (!searchConfiguration.enabled) {
      classNames.push("disabled");
      badgeIcon = <PauseOutlined style={{ color: "#ffffff" }} />;
      badgeColor = "#c5981c";
    } else if (searchConfiguration.status === "running") {
      classNames.push("running");
      badgeIcon = <ReloadOutlined style={{ color: "#ffffff" }} spin={true} />;
      badgeColor = "#023c53";
    } else if (searchConfiguration.status === "error") {
      classNames.push("error");
      badgeIcon = <CloseOutlined style={{ color: "#ffffff" }} />;
      badgeColor = "#7d0000";
    }

    searchButton = (
      <div ref={buttonRef}>
        <Popover
          classNames={{
            root: `pill large ${className}`,
            body: classNames.join(" "),
          }}
          placement={"bottom"}
          open={open}
          getPopupContainer={() => buttonRef.current!}
          onOpenChange={(visible) => {
            setOpen(visible);
          }}
          trigger={"click"}
          content={
            <Space size={8} direction={"vertical"}>
              <Button
                type={"text"}
                icon={
                  searchConfiguration.enabled ? (
                    <PauseOutlined />
                  ) : (
                    <CaretRightOutlined />
                  )
                }
                loading={configUpdating}
                onClick={async () => {
                  await updateSearchConfiguration(false);
                }}
              />
              {(searchConfiguration.type === "tv_series" ||
                searchConfiguration.type === "tv_season") && (
                <Button
                  type={"text"}
                  icon={
                    searchConfiguration.enabled ? (
                      <DoubleLeftOutlined />
                    ) : (
                      <DoubleRightOutlined />
                    )
                  }
                  loading={configUpdating}
                  onClick={async () => {
                    await updateSearchConfiguration(true);
                  }}
                />
              )}
              <Button
                type={"text"}
                icon={<ReloadOutlined />}
                onClick={async () => {
                  try {
                    setconfigUpdating(true);
                    closeMenu();
                    await handleTriggerSearch(mediaType, mediaId, afterUpdate);
                  } finally {
                    setconfigUpdating(false);
                  }
                }}
              />
            </Space>
          }
          zIndex={1}
        >
          <Badge
            offset={[0, 32]}
            style={{ zIndex: 102 }}
            count={
              <Space
                style={{
                  background: badgeColor,
                  borderRadius: 16,
                  padding: 3,
                  fontSize: "12px",
                  zIndex: 101,
                }}
              >
                {badgeIcon}
              </Space>
            }
          >
            <Button
              className={classNames.join(" ")}
              size={"large"}
              shape={"circle"}
              icon={<EyeFilled />}
              loading={loading || configUpdating}
              onClick={closeMenu}
              style={{
                border: open ? "none" : "1px solid #cccccc",
                display: "flex",
                alignItems: "center",
                alignContent: "center",
                zIndex: 100,
              }}
            />
          </Badge>
        </Popover>
      </div>
    );
  }

  return searchButton;
};
export default SearchConfigurationButton;

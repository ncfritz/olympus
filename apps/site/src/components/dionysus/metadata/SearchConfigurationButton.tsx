import {
  CaretRightOutlined,
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
          closeMenu();
        }
      }}
    />
  );

  if (searchConfiguration) {
    const classNames = ["dionysus-action-button", className, "active"];

    if (open) {
      classNames.push("no-hover");
    }

    if (!searchConfiguration.enabled) {
      classNames.push("disabled");
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
                  try {
                    setconfigUpdating(true);
                    await handleSetEnabled(
                      mediaType,
                      mediaId,
                      !searchConfiguration.enabled,
                      afterUpdate,
                    );
                  } finally {
                    setconfigUpdating(false);
                    closeMenu();
                  }
                }}
              />
              <Button
                type={"text"}
                icon={<ReloadOutlined />}
                onClick={() => {}}
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
                  background: searchConfiguration.enabled
                    ? "#488633"
                    : "#c5981c",
                  borderRadius: 16,
                  padding: 3,
                  fontSize: "12px",
                  zIndex: 101,
                }}
              >
                {searchConfiguration.enabled ? (
                  <CaretRightOutlined style={{ color: "#ffffff" }} />
                ) : (
                  <PauseOutlined style={{ color: "#ffffff" }} />
                )}
              </Space>
            }
          >
            <Button
              className={classNames.join(" ")}
              size={"large"}
              shape={"circle"}
              icon={<EyeFilled />}
              loading={loading}
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

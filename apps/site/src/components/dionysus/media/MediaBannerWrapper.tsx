import {
  CheckCircleFilled,
  EyeFilled,
  PauseCircleFilled,
} from "@ant-design/icons";
import type { MediaAssetSearchConfiguration } from "@ncfritz/olympus-sdk/dionysus";
import { Badge } from "antd";
import React, { type ReactNode } from "react";

export interface MediaBannerWrapperProps {
  children: ReactNode;
  asset?: boolean;
  searchConfiguration?: MediaAssetSearchConfiguration;
  showAsset?: boolean;
  showSearchConfiguration?: boolean;
}

const MediaBannerWrapper: React.FunctionComponent<MediaBannerWrapperProps> = ({
  children,
  asset,
  searchConfiguration,
  showAsset = true,
  showSearchConfiguration = true,
}: MediaBannerWrapperProps) => {
  if (asset && showAsset) {
    return (
      <Badge.Ribbon
        color={"#478133"}
        style={{ fontSize: "12px" }}
        text={<CheckCircleFilled />}
      >
        {children}
      </Badge.Ribbon>
    );
  }

  if (searchConfiguration && showSearchConfiguration) {
    return (
      <Badge.Ribbon
        color={searchConfiguration.enabled ? "#2657a8" : "#c5981c"}
        style={{ fontSize: "12px" }}
        text={
          searchConfiguration.enabled ? <EyeFilled /> : <PauseCircleFilled />
        }
      >
        {children}
      </Badge.Ribbon>
    );
  }

  return children;
};
export default MediaBannerWrapper;

import { Form, Switch, Tabs, type TabsProps } from "antd";
import axios from "axios";
import { useEffect, useState } from "react";
import { CONTENT_CDN_HOST } from "../../utils/constants";
import LoadingWrapper from "../common/LoadingWrapper";
import MediaAssetFFMpegDetails from "./MediaAssetFFMpegDetails";

export interface ContentAssetDetailsPanelProps {
  assetId?: string;
}

const ContentAssetDetailsPanel: React.FunctionComponent<
  ContentAssetDetailsPanelProps
> = ({ assetId }: ContentAssetDetailsPanelProps) => {
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<Error | undefined>(
    undefined,
  );
  const [assetMetadata, setAssetMetadata] = useState(undefined);
  const [originalMetadata, setOriginalMetadata] = useState(undefined);
  const [showRawMetadata, setShowRawMetadata] = useState(false);

  const fetchMetadata = async () => {
    setMetadataLoading(true);
    setMetadataError(undefined);

    try {
      const fetchAssetMetadataResponse = await axios.get(
        `${CONTENT_CDN_HOST}/assets/${assetId}/metadata.json`,
      );
      setAssetMetadata(fetchAssetMetadataResponse.data);

      const fetchOriginalMetadataResponse = await axios.get(
        `${CONTENT_CDN_HOST}/assets/${assetId}/original_metadata.json`,
      );
      setOriginalMetadata(fetchOriginalMetadataResponse.data);
    } catch (e) {
      setMetadataError(e);
    } finally {
      setMetadataLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (assetId) {
        await fetchMetadata();
      }
    })();
  }, [assetId]);

  const items: TabsProps["items"] = [
    {
      key: "asset-md",
      label: `Asset Metadata`,
      children: (
        <LoadingWrapper loading={metadataLoading} error={metadataError}>
          <MediaAssetFFMpegDetails
            metadata={assetMetadata}
            showRaw={showRawMetadata}
          />
        </LoadingWrapper>
      ),
    },
    {
      key: "original-md",
      label: `Original Metadata`,
      children: (
        <LoadingWrapper loading={metadataLoading} error={metadataError}>
          <MediaAssetFFMpegDetails
            metadata={originalMetadata}
            showRaw={showRawMetadata}
          />
        </LoadingWrapper>
      ),
    },
  ];

  return (
    <Tabs
      defaultActiveKey={"asset-md"}
      items={items}
      tabBarStyle={{
        paddingLeft: 24,
        position: "fixed",
        zIndex: 1,
        top: 57,
        width: 748,
        background: "#ffffff",
      }}
      style={{
        position: "relative",
        paddingTop: 64,
      }}
      tabBarExtraContent={{
        right: (
          <Form.Item label={"Show Raw JSON"} style={{ marginRight: 16 }}>
            <Switch
              size={"small"}
              checked={showRawMetadata}
              onClick={(value) => setShowRawMetadata(value)}
            ></Switch>
          </Form.Item>
        ),
      }}
    />
  );
};
export default ContentAssetDetailsPanel;

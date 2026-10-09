import type { MediaAssetSearchType } from "@ncfritz/olympus-sdk/dionysus";
import { Empty, Form, Switch, Tabs, type TabsProps } from "antd";
import axios from "axios";
import { useEffect, useState } from "react";
import { DIONYSUS_CDN_HOST } from "../../../utils/constants";
import type { FFProbeMetadata } from "../../../utils/ffprobe";
import LoadingWrapper from "../../common/LoadingWrapper";
import MediaAssetFFMpegDetails from "../../content/MediaAssetFFMpegDetails";

export interface ContentAssetDetailsPanelProps {
  assetType: MediaAssetSearchType;
  assetId?: number;
}

const ContentAssetDetailsPanel: React.FunctionComponent<
  ContentAssetDetailsPanelProps
> = ({ assetType, assetId }: ContentAssetDetailsPanelProps) => {
  const [assetMetadataLoading, setAssetMetadataLoading] = useState(true);
  const [assetMetadataError, setAssetMetadataError] = useState<
    Error | undefined
  >(undefined);
  const [assetMetadata, setAssetMetadata] = useState<
    FFProbeMetadata | undefined
  >(undefined);
  const [originalMetadataLoading, setOriginalMetadataLoading] = useState(true);
  const [originalMetadataError, setOriginalMetadataError] = useState<
    Error | undefined
  >(undefined);
  const [originalMetadata, setOriginalMetadata] = useState<
    FFProbeMetadata | undefined
  >(undefined);
  const [showRawMetadata, setShowRawMetadata] = useState(false);

  const fetchMetadata = async (
    mdType: "metadata" | "original_metadata",
    setMetadata: (md?: FFProbeMetadata) => void,
    setError: (e?: Error) => void,
    setLoading: (loading: boolean) => void,
  ) => {
    setLoading(true);
    setError(undefined);

    try {
      const fetchAssetMetadataResponse = await axios.get(
        `${DIONYSUS_CDN_HOST}/metadata/${assetType}/${assetId}/${mdType}.json`,
      );
      setMetadata(fetchAssetMetadataResponse.data);
    } catch (e) {
      if (e.response && e.response.status == 404) {
        setMetadata(undefined);
      } else {
        setError(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (assetId) {
        await fetchMetadata(
          "original_metadata",
          setOriginalMetadata,
          setOriginalMetadataError,
          setOriginalMetadataLoading,
        );
        await fetchMetadata(
          "metadata",
          setAssetMetadata,
          setAssetMetadataError,
          setAssetMetadataLoading,
        );
      }
    })();
  }, [assetId]);

  console.log(originalMetadata);

  const items: TabsProps["items"] = [
    {
      key: "asset-md",
      label: `Asset Metadata`,
      children: (
        <LoadingWrapper
          loading={assetMetadataLoading}
          error={assetMetadataError}
        >
          {assetMetadata ? (
            <MediaAssetFFMpegDetails
              metadata={assetMetadata}
              showRaw={showRawMetadata}
            />
          ) : (
            <Empty />
          )}
        </LoadingWrapper>
      ),
    },
    {
      key: "original-md",
      label: `Original Metadata`,
      children: (
        <LoadingWrapper
          loading={originalMetadataLoading}
          error={originalMetadataError}
        >
          {originalMetadata ? (
            <MediaAssetFFMpegDetails
              metadata={originalMetadata}
              showRaw={showRawMetadata}
            />
          ) : (
            <Empty />
          )}
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

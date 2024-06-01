import { Spin, Tabs, type TabsProps } from "antd";
import axios from "axios";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

export interface ContentAssetDetailsPanelProps {
  assetId?: string;
}

const ContentAssetDetailsPanel: React.FunctionComponent<
  ContentAssetDetailsPanelProps
> = ({ assetId }: ContentAssetDetailsPanelProps) => {
  const DynamicReactJson = dynamic(import("react-json-view"), { ssr: false });

  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<any>(false);
  const [assetMetadata, setAssetMetadata] = useState(undefined);
  const [originalMetadata, setOriginalMetadata] = useState(undefined);

  const fetchMetadata = async () => {
    setMetadataLoading(true);
    setMetadataError(undefined);

    try {
      const fetchAssetMetadataResponse = await axios.get(
        `https://content-cdn.sea.ncfritz.net:9443/assets/${assetId}/metadata.json`,
      );
      setAssetMetadata(fetchAssetMetadataResponse.data);

      const fetchOriginalMetadataResponse = await axios.get(
        `https://content-cdn.sea.ncfritz.net:9443/assets/${assetId}/original_metadata.json`,
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

  if (metadataLoading) {
    return <Spin spinning={true} />;
  }

  const items: TabsProps["items"] = [
    {
      key: "asset-md",
      label: `Asset Metadata`,
      children: (
        <DynamicReactJson
          style={{
            marginLeft: 24,
            fontSize: 10,
          }}
          src={assetMetadata || {}}
          indentWidth={2}
          iconStyle={"square"}
          displayDataTypes={false}
          enableClipboard={true}
        />
      ),
    },
    {
      key: "original-md",
      label: `Original Metadata`,
      children: (
        <DynamicReactJson
          style={{
            marginLeft: 24,
            fontSize: 10,
          }}
          src={originalMetadata || {}}
          indentWidth={2}
          iconStyle={"square"}
          displayDataTypes={false}
          enableClipboard={true}
        />
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
        width: "100%",
        background: "#ffffff",
      }}
      style={{
        position: "relative",
        paddingTop: 64,
      }}
    />
  );
};
export default ContentAssetDetailsPanel;

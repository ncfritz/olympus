import type {
  ContentAsset,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import { Card, Image, List, Space, Typography } from "antd";
import contentApi from "../../api/contentApi";
import { useFetch } from "../../hooks/useFetch";
import LoadingWrapper from "../common/LoadingWrapper";
import ContentAssetFixedRatioImage from "./ContentAssetFixedRatioImage";

export interface ContentAssetChannelPreviewPannelProps {
  filters?: FilterDefinition;
}

const ContentAssetChannelPreviewPannel: React.FunctionComponent<
  ContentAssetChannelPreviewPannelProps
> = ({ filters }: ContentAssetChannelPreviewPannelProps) => {
  const [assets, assetsLoading, assetsError] = useFetch<
    undefined,
    ContentAsset[]
  >({
    dataType: "content asset channel preview",
    params: undefined,
    fetchFunction: async () => {
      return (
        await contentApi.listAssets(
          0,
          10,
          { field: "rating", order: "desc" },
          filters,
        )
      ).data.assets;
    },
  });

  return (
    <LoadingWrapper loading={assetsLoading} error={assetsError}>
      <List
        style={{ width: "100%" }}
        grid={{ column: 5, gutter: 16 }}
        dataSource={assets}
        renderItem={(item) => {
          return (
            <List.Item>
              <Card
                style={{ height: 275 }}
                styles={{ body: { padding: 8 } }}
                hoverable={false}
                cover={
                  <ContentAssetFixedRatioImage
                    assetId={item.id}
                    previewIndex={2}
                    allowPreview={false}
                    width={item.width}
                    height={item.height}
                    maxWidth={301}
                    maxHeight={200}
                  />
                }
              >
                <Typography.Text style={{ fontSize: "11px" }}>
                  {item.originalName}
                </Typography.Text>
              </Card>
            </List.Item>
          );
        }}
      />
    </LoadingWrapper>
  );
};
export default ContentAssetChannelPreviewPannel;

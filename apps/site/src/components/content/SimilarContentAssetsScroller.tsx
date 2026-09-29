import { StarFilled } from "@ant-design/icons";
import type {
  ContentAsset,
  ContentAssetTag,
} from "@ncfritz/olympus-sdk/dionysus";
import { Card, Empty, Rate, Space, Spin, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { ScrollMenu, VisibilityContext } from "react-horizontal-scrolling-menu";
import contentApi from "../../api/contentApi";
import useDrag from "../../hooks/useDrag";
import { useAppSelector } from "../../redux/hooks";
import { CONTENT_CDN_HOST } from "../../utils/constants";
import { LeftArrow, RightArrow } from "./scroller/arrows";

export interface SimilarContentAssetsScrollerProps {
  asset: ContentAsset;
  tags: ContentAssetTag[];
}

const SimilarContentAssetScroller: React.FunctionComponent<
  SimilarContentAssetsScrollerProps
> = ({ asset, tags }: SimilarContentAssetsScrollerProps) => {
  type scrollVisibilityApiType = React.ContextType<typeof VisibilityContext>;

  const router = useRouter();
  const blackCurtainEnabled = useAppSelector(
    (state) => state.blackCurtain.active,
  );

  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState<any>(true);
  const [assetsError, setAssetsError] = useState<any>();
  const [selected, setSelected] = React.useState([]);
  const [position, setPosition] = React.useState(0);

  const { dragStart, dragStop, dragMove, dragging } = useDrag();

  const fetchAssets = async () => {
    setAssetsLoading(true);
    setAssetsError(undefined);

    try {
      const listAssetsResponse = await contentApi.listSimilarAssets(
        asset,
        tags,
      );
      setAssets(listAssetsResponse.data.assets);
    } catch (e) {
      setAssetsError(e);
    } finally {
      setAssetsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAssets();
    })();
  }, [tags, blackCurtainEnabled]);

  const handleDrag =
    ({ scrollContainer }: scrollVisibilityApiType) =>
    (ev: React.MouseEvent) =>
      dragMove(ev, (posDiff) => {
        if (scrollContainer.current) {
          scrollContainer.current.scrollLeft += posDiff;
        }
      });

  const isItemSelected = (id: string) => !!selected.find((el) => el === id);

  function ScrollMenuItem({
    asset,
  }: {
    selected: boolean;
    title: string;
    itemId: string;
    asset: ContentAsset;
  }) {
    return (
      <Card
        hoverable={false}
        style={{
          width: "230px",
          marginRight: 16,
        }}
        tabIndex={0}
        cover={
          <img
            src={`${CONTENT_CDN_HOST}/assets/${asset.id}/thumbnails/3.png`}
            height={150}
          />
        }
      >
        <Space size={4} direction={"vertical"} style={{ display: "block" }}>
          <Typography.Text ellipsis={true}>
            <Link
              href={`/dionysus/content/asset/${asset.id}`}
              as={`/dionysus/content/asset/${asset.id}`}
              shallow={true}
            >
              {asset.name || asset.originalName}
            </Link>
          </Typography.Text>
          <Rate
            allowHalf={true}
            character={<StarFilled />}
            disabled={true}
            value={asset.rating}
          />
        </Space>
      </Card>
    );
  }

  let scrollerContent;

  if (assetsLoading) {
    scrollerContent = <Spin spinning={true} />;
  } else if (assetsError) {
    scrollerContent = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  } else if (assets.length <= 0) {
    scrollerContent = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  } else {
    scrollerContent = (
      <div onMouseLeave={dragStop}>
        <ScrollMenu LeftArrow={LeftArrow} RightArrow={RightArrow}>
          {assets.map((asset) => (
            <ScrollMenuItem
              itemId={asset.id}
              asset={asset}
              title={asset.id}
              key={asset.id}
              selected={isItemSelected(asset.id)}
            />
          ))}
        </ScrollMenu>
      </div>
    );
  }

  return scrollerContent;
};
export default SimilarContentAssetScroller;

import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import contentApi from "../../api/contentApi";
import ContentAssetTag from "./ContentAssetTag";
import type { ContentAssetTag as ContentAssetTagType } from "../../pages/dionysus/content/assets";

export interface ContentAssetTagSelectorProps {
  assetId: string;
  title: string;
  type: string;
  tags: ContentAssetTagType[];
  onSelectTag?: (tag: ContentAssetTagType) => Promise<void>;
  onRemove?: (tag: ContentAssetTagType) => Promise<void>;
  allowFilter?: boolean;
  allowAdd?: boolean;
  afterAdd?: (tag: ContentAssetTagType) => Promise<void>;
}

const ContentAssetTagSelector: React.FunctionComponent<
  ContentAssetTagSelectorProps
> = ({
  assetId,
  title,
  type,
  tags,
  onSelectTag,
  onRemove,
  allowAdd = false,
  allowFilter = false,
  afterAdd,
}: ContentAssetTagSelectorProps) => {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [filteredTags, setFilteredTags] = useState(tags);

  useEffect(() => {
    if (!filter) {
      return setFilteredTags(tags);
    }

    const newFilteredTags = tags.filter((tag) => {
      return tag.name.toLowerCase().indexOf(filter.toLowerCase()) > -1;
    });

    setFilteredTags(newFilteredTags);
  }, [filter, tags]);

  const addTag = async (type: string, name: string) => {
    const existingTag = tags.find((tag) => {
      return tag.name.toLowerCase() === name.toLowerCase();
    });

    if (existingTag && onSelectTag) {
      await onSelectTag(existingTag);
      return;
    }

    const response = await contentApi.createAssetTag(type, name);

    if (onSelectTag) {
      await onSelectTag(response.data.tag);
    }

    if (afterAdd) {
      await afterAdd(response.data.tag);
    }
  };

  let content = <Empty description={"No tags"} />;

  if (tags.length > 0) {
    content = (
      <>
        {(allowAdd || allowFilter) && (
          <div
            style={{
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            {allowAdd && (
              <Space.Compact>
                <Input
                  size={"small"}
                  value={filter}
                  allowClear={true}
                  placeholder={"tag"}
                  onChange={(e) => {
                    setFilter(e.target.value);
                  }}
                  onPressEnter={async () => {
                    if (filter && filter.length > 0) {
                      await addTag(type, filter);
                      setFilter(undefined);
                    }
                  }}
                  name={"filter"}
                />
                <Button
                  icon={<PlusOutlined />}
                  size={"small"}
                  onClick={async () => {
                    if (filter && filter.length > 0) {
                      await addTag(type, filter);
                    }
                  }}
                />
              </Space.Compact>
            )}
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            rowGap: 6,
            overflowY: "scroll",
            height: "100%",
          }}
        >
          {filteredTags.map((tag) => {
            return (
              <ContentAssetTag
                assetId={assetId}
                tag={tag}
                onSelectTag={onSelectTag}
                onRemove={onRemove}
              />
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: 200 }}>
      <Typography.Title level={5}>{title}</Typography.Title>
      {content}
    </div>
  );
};
export default ContentAssetTagSelector;

import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type {
  ContentTagType,
  ContentAssetTag,
} from "@ncfritz/olympus-sdk/dionysus";
import { Button, Empty, Input, Space, Typography } from "antd";
import { type CSSProperties, useEffect, useState } from "react";
import contentApi from "../../api/contentApi";
import {
  SelectableTagRenderer,
  type SelectableTagRenderOptions,
} from "./SelectableContentTag";

export interface TagRendererOptions {
  onSelectTag?: (tag: ContentAssetTag) => Promise<void>;
  onRemoveTag?: (tag: ContentAssetTag) => Promise<void>;
  allowClear?: boolean;
}

export type DefaultTagRendererOptions = TagRendererOptions;

export interface TagRenderedOptionsWithState extends TagRendererOptions {
  checked?: boolean;
}

export type TagRenderer<T extends TagRendererOptions> = (
  tag: ContentAssetTag,
  options?: T,
) => React.ReactNode;

export interface ContentAssetTagSelectorProps<T extends TagRendererOptions> {
  title?: string;
  type: ContentTagType | "selected";
  tags: ContentAssetTag[];
  onSelectTag?: (tag: ContentAssetTag) => Promise<void>;
  onRemoveTag?: (tag: ContentAssetTag) => Promise<void>;
  allowFilter?: boolean;
  allowAdd?: boolean;
  afterAdd?: (tag: ContentAssetTag) => Promise<void>;
  width?: number | string;
  tagRenderer?: TagRenderer<T>;
  titleStyle?: CSSProperties;
  initialTags?: string[];
  allowClear?: boolean;
}

const ContentAssetTagSelector: React.FunctionComponent<
  ContentAssetTagSelectorProps<SelectableTagRenderOptions>
> = ({
  title,
  type,
  tags,
  onSelectTag,
  onRemoveTag,
  allowAdd = false,
  allowFilter = false,
  afterAdd,
  width = 200,
  tagRenderer = SelectableTagRenderer,
  titleStyle,
  initialTags,
  allowClear = false,
}: ContentAssetTagSelectorProps<TagRenderedOptionsWithState>) => {
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

  const addTag = async (type: ContentTagType | "selected", name: string) => {
    if (type === "selected") {
      return;
    }

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

  let content = <Empty description={"No tags"} style={{ marginTop: 36 }} />;

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
            {allowFilter && (
              <Space.Compact style={{ width: "100%", paddingRight: 4 }}>
                <Input
                  size={"small"}
                  value={filter}
                  allowClear={true}
                  placeholder={"tag"}
                  onChange={(e) => {
                    setFilter(e.target.value);
                  }}
                  prefix={<SearchOutlined />}
                  onPressEnter={async () => {
                    if (filter && filter.length > 0) {
                      await addTag(type, filter);
                      setFilter(undefined);
                    }
                  }}
                  name={"filter"}
                />
                {allowAdd && (
                  <Button
                    icon={<PlusOutlined />}
                    size={"small"}
                    onClick={async () => {
                      if (filter && filter.length > 0) {
                        await addTag(type, filter);
                      }
                    }}
                  />
                )}
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
            paddingBottom: 8,
          }}
        >
          {filteredTags.map((tag) => {
            return tagRenderer(tag, {
              onSelectTag: onSelectTag,
              onRemoveTag: onRemoveTag,
              checked: initialTags?.includes(tag.id),
              allowClear: allowClear,
            });
          })}
        </div>
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: width }}>
      {title && (
        <Typography.Title
          level={5}
          style={{ marginBottom: 0, paddingTop: 16, ...titleStyle }}
        >
          {title}
        </Typography.Title>
      )}
      {content}
    </div>
  );
};
export default ContentAssetTagSelector;

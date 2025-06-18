import { SearchOutlined } from "@ant-design/icons";
import { Button, Collapse, Empty, Space, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
import contentApi from "../../api/contentApi";
import type { ContentAssetTag as ContentAssetTagType } from "../../pages/dionysus/content/assets";
import ContentAssetTagSelector, {
  type TagRenderer,
} from "./ContentAssetTagSelector";
import ContentTagCheckbox from "./ContentTagCheckbox";

export interface ContentAssetFilterPanelProps {
  togglePanel: () => void;
  onSelectTag: (tag: ContentAssetTagType) => Promise<void>;
  onRemoveTag: (tag: ContentAssetTagType) => Promise<void>;
}

const CheckboxTagRenderer: TagRenderer = (
  tag: ContentAssetTagType,
  onSelectTag: (tag: ContentAssetTagType) => Promise<void>,
  onRemoveTag: (tag: ContentAssetTagType) => Promise<void>,
) => {
  return (
    <ContentTagCheckbox
      tag={tag}
      onSelectTag={onSelectTag}
      onRemoveTag={onRemoveTag}
    />
  );
};

const ContentAssetFilterPanel: React.FunctionComponent<
  ContentAssetFilterPanelProps
> = ({
  togglePanel,
  onSelectTag,
  onRemoveTag,
}: ContentAssetFilterPanelProps) => {
  const [tags, setTags] = useState<Record<string, any[]>>({});
  const [tagsLoading, setTagsLoading] = useState<boolean>(false);
  const [tagsError, setTagsError] = useState<any>(false);

  const fetchTags = async (quiet = false) => {
    if (!quiet) {
      setTagsLoading(true);
    }
    setTagsError(undefined);

    try {
      const listTagsResponse = await contentApi.listTags();
      const tagGroups: Record<string, any[]> = {};

      listTagsResponse.data.tags.forEach((tag: any) => {
        if (!(tag.type in tagGroups)) {
          tagGroups[tag.type] = [];
        }

        tagGroups[tag.type].push(tag);
      });

      setTags(tagGroups);
    } catch (e) {
      setTagsError(e);
    } finally {
      setTagsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchTags();
    })();
  }, []);

  let content: any;

  if (tagsLoading) {
    content = <Spin size={"large"} />;
  } else if (!tags || Object.keys(tags).length <= 0) {
    content = <Empty />;
  } else {
    content = (
      <Collapse
        ghost={true}
        collapsible={"header"}
        defaultActiveKey={[
          "content-tags-type",
          "content-tags-source",
          "content-tags-user",
        ]}
        items={[
          {
            key: "content-tags-type",
            label: (
              <Typography.Title level={5} style={{ marginBottom: 0 }}>
                Content Type
              </Typography.Title>
            ),
            styles: {
              body: {
                marginBottom: 24,
              },
            },
            children: (
              <ContentAssetTagSelector
                type={"type"}
                tags={tags["type"]}
                onSelectTag={onSelectTag}
                onRemove={onRemoveTag}
                allowFilter={false}
                width={"100%"}
                tagRenderer={CheckboxTagRenderer}
              />
            ),
          },
          {
            key: "content-tags-source",
            label: (
              <Typography.Title level={5} style={{ marginBottom: 0 }}>
                Source
              </Typography.Title>
            ),
            styles: {
              body: {
                marginBottom: 24,
              },
            },
            children: (
              <ContentAssetTagSelector
                type={"source"}
                tags={tags["source"]}
                onSelectTag={onSelectTag}
                onRemove={onRemoveTag}
                allowFilter={true}
                width={"100%"}
                tagRenderer={CheckboxTagRenderer}
              />
            ),
          },
          {
            key: "content-tags-user",
            label: (
              <Typography.Title level={5} style={{ marginBottom: 0 }}>
                User Tags
              </Typography.Title>
            ),
            styles: {
              body: {
                marginBottom: 24,
              },
            },
            children: (
              <ContentAssetTagSelector
                type={"user"}
                tags={tags["user"]}
                onSelectTag={onSelectTag}
                onRemove={onRemoveTag}
                allowFilter={true}
                width={"100%"}
                tagRenderer={CheckboxTagRenderer}
              />
            ),
          },
          {
            key: "content-tags-model",
            label: (
              <Typography.Title level={5} style={{ marginBottom: 0 }}>
                Model
              </Typography.Title>
            ),
            styles: {
              body: {
                marginBottom: 24,
              },
            },
            children: (
              <ContentAssetTagSelector
                type={"model"}
                tags={tags["model"]}
                onSelectTag={onSelectTag}
                onRemove={onRemoveTag}
                allowFilter={true}
                width={"100%"}
                tagRenderer={CheckboxTagRenderer}
              />
            ),
          },
          {
            key: "content-tags-system",
            label: (
              <Typography.Title level={5} style={{ marginBottom: 0 }}>
                System Tags
              </Typography.Title>
            ),
            styles: {
              body: {
                marginBottom: 24,
              },
            },
            children: (
              <ContentAssetTagSelector
                type={"system"}
                tags={tags["system"]}
                onSelectTag={onSelectTag}
                onRemove={onRemoveTag}
                allowFilter={true}
                width={"100%"}
                tagRenderer={CheckboxTagRenderer}
              />
            ),
          },
        ]}
      />
    );
  }

  return (
    <Space
      direction={"vertical"}
      style={{ width: "100%" }}
      styles={{
        item: {
          width: "100%",
        },
      }}
    >
      <Space
        style={{
          borderBottom: "1px solid #f0f0f0",
          background: "#fafafa",
          width: "100%",
          padding: 11,
        }}
      >
        <Button type={"text"} size={"small"} onClick={togglePanel}>
          <SearchOutlined />
        </Button>
      </Space>
      <Space direction={"vertical"} style={{ width: "100%", padding: 12 }}>
        {content}
      </Space>
    </Space>
  );
};
export default ContentAssetFilterPanel;

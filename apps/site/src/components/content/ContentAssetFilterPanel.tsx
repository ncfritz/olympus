import { SearchOutlined } from "@ant-design/icons";
import type { ContentAssetTag } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Collapse, Empty, Space, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
import contentApi from "../../api/contentApi";
import { useFetch } from "../../hooks/useFetch";
import ContentAssetTagSelector, {
  type TagRenderer,
} from "./ContentAssetTagSelector";
import ContentTagCheckbox from "./ContentTagCheckbox";
import { getTagColor } from "./util";

export interface ContentAssetFilterPanelProps {
  togglePanel: () => void;
  onSelectTag: (tag: ContentAssetTag) => Promise<void>;
  onRemoveTag: (tag: ContentAssetTag) => Promise<void>;
}

const CheckboxTagRenderer: TagRenderer = (
  tag: ContentAssetTag,
  onSelectTag: (tag: ContentAssetTag) => Promise<void>,
  onRemoveTag: (tag: ContentAssetTag) => Promise<void>,
) => {
  return (
    <ContentTagCheckbox
      tag={tag}
      color={getTagColor(tag)}
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
  const [contentTags, setContentTags] = useState<
    Record<string, ContentAssetTag[]>
  >({});

  const [tags, tagsLoading, tagsError] = useFetch<undefined, ContentAssetTag[]>(
    {
      dataType: "tags",
      params: undefined,
      fetchFunction: async () => (await contentApi.listTags()).data.tags,
    },
  );

  useEffect(() => {
    if (!tags || tags.length <= 0) {
      return;
    }

    const tagGroups: Record<string, ContentAssetTag[]> = {};

    tags.forEach((tag) => {
      if (!(tag.type in tagGroups)) {
        tagGroups[tag.type] = [];
      }

      tagGroups[tag.type].push(tag);
    });

    setContentTags(tagGroups);
  }, [tags]);

  let content: any;

  if (tagsLoading) {
    content = <Spin size={"large"} />;
  } else if (!contentTags || Object.keys(contentTags).length <= 0) {
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
              <Typography.Title
                level={5}
                style={{ marginBottom: 8, fontSize: "14px" }}
              >
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
                tags={contentTags["type"]}
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
              <Typography.Title
                level={5}
                style={{ marginBottom: 0, fontSize: "14px" }}
              >
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
                tags={contentTags["source"]}
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
              <Typography.Title
                level={5}
                style={{ marginBottom: 0, fontSize: "14px" }}
              >
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
                tags={contentTags["user"]}
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
              <Typography.Title
                level={5}
                style={{ marginBottom: 0, fontSize: "14px" }}
              >
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
                tags={contentTags["model"]}
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
                tags={contentTags["system"]}
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
      style={{ width: "100%", height: "100%" }}
      styles={{
        item: {
          width: "100%",
        },
      }}
    >
      <Space
        style={{
          position: "fixed",
          marginTop: -16,
          borderBottom: "1px solid #f0f0f0",
          background: "#fafafa",
          width: 298,
          zIndex: 5,
          padding: 10,
        }}
      >
        <Button type={"text"} size={"small"} onClick={togglePanel}>
          <SearchOutlined />
        </Button>
      </Space>
      <Space
        direction={"vertical"}
        style={{ width: "100%", padding: 12, marginTop: 24 }}
      >
        {content}
      </Space>
    </Space>
  );
};
export default ContentAssetFilterPanel;

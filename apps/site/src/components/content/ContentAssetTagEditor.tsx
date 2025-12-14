import {
  CloudOutlined,
  DesktopOutlined,
  PlusOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type {
  ContentAssetTag,
  ContentTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  AutoComplete,
  Button,
  Col,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { type ReactElement, useEffect, useState } from "react";
import contentApi from "../../api/contentApi";
import ContentAssetTagElement from "./ContentAssetTagElement";

export interface ContentAssetTagEditorProps {
  asset: any;
  onTagRemoved?: (tag: ContentAssetTag) => Promise<void>;
}

const ContentAssetTagEditor: React.FunctionComponent<
  ContentAssetTagEditorProps
> = ({ asset, onTagRemoved }: ContentAssetTagEditorProps) => {
  const [tagType, setTagType] = useState<ContentTagType>("user");
  const [tagValue, setTagValue] = useState<string | undefined>(undefined);
  const [tagAddedLoading, setTagAddedLoading] = useState(false);
  const [tagsModified, setTagsModified] = useState(false);

  const [assetTags, setAssetTags] = useState<any>(asset.tags);
  const [assetTagsLoading, setAssetTagsLoading] = useState<any>(false);
  const [assetTagsError, setAssetTagsError] = useState<any>();

  const [availableAssetTags, setAvailableAssetTags] = useState<any[]>([]);
  const [availableAssetTagsLoading, setAvailableAssetTagsLoading] =
    useState<any>(true);
  const [availableAssetTagsError, setAvailableAssetTagsError] = useState<any>();

  const [tagOptions, setTagOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const fetchAssetTags = async (quiet = false) => {
    if (!quiet) {
      setAssetTagsLoading(true);
    }
    setAssetTagsError(undefined);

    try {
      const listAssetTagsResponse = await contentApi.listAssetTags(asset.id);
      setAssetTags(listAssetTagsResponse.data.tags);
    } catch (e) {
      setAssetTagsError(e);
    } finally {
      setAssetTagsLoading(false);
    }
  };

  const fetchAvailableAssetTags = async () => {
    setAvailableAssetTagsLoading(true);
    setAvailableAssetTagsError(undefined);

    try {
      const listAvailableAssetTagsResponse =
        await contentApi.listAvailableTagsForAsset(asset.id);
      setAvailableAssetTags(listAvailableAssetTagsResponse.data.tags);
    } catch (e) {
      setAvailableAssetTagsError(e);
    } finally {
      setAvailableAssetTagsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (tagsModified) {
        await fetchAssetTags();
      }
    })();
  }, [tagsModified, asset]);

  useEffect(() => {
    (async () => {
      await fetchAvailableAssetTags();
    })();
  }, [assetTags, tagType]);

  const filterTags = (value: string) => {
    const targetTagType = tagType || "user";
    const options: { value: string; label: string }[] = [];

    availableAssetTags.forEach((tag: ContentAssetTag) => {
      if (tag.type === targetTagType) {
        if (
          value.trim().length > 0 &&
          tag.name.toLowerCase().includes(value.toLowerCase())
        ) {
          options.push({ value: tag.name, label: tag.name });
        }
      }
    });

    setTagOptions(options);
  };

  const removeTag = async (tag: ContentAssetTag) => {
    await contentApi.removeTagFromAsset(asset.id, tag.id);
    await fetchAssetTags(true);

    if (onTagRemoved) {
      await onTagRemoved(tag);
    }
  };

  useEffect(() => {
    filterTags(tagType);
  }, [tagType]);

  const generateTags = () => {
    const systemTags: ReactElement[] = [];
    const userTags: ReactElement[] = [];
    const typeTags: ReactElement[] = [];
    const sourceTags: ReactElement[] = [];
    const modelTags: ReactElement[] = [];

    assetTags.forEach((tag: ContentAssetTag) => {
      switch (tag.type) {
        case "system":
          systemTags.push(
            <ContentAssetTagElement
              key={tag.id}
              tag={tag}
              onRemoveTag={removeTag}
            />,
          );
          break;
        case "user":
          userTags.push(
            <ContentAssetTagElement
              key={tag.id}
              tag={tag}
              onRemoveTag={removeTag}
            />,
          );
          break;
        case "type":
          typeTags.push(
            <ContentAssetTagElement
              key={tag.id}
              tag={tag}
              onRemoveTag={removeTag}
            />,
          );
          break;
        case "source":
          sourceTags.push(
            <ContentAssetTagElement
              key={tag.id}
              tag={tag}
              onRemoveTag={removeTag}
            />,
          );
          break;
        case "model":
          modelTags.push(
            <ContentAssetTagElement
              key={tag.id}
              tag={tag}
              onRemoveTag={removeTag}
            />,
          );
          break;
      }
    });

    return (
      <>
        <Row
          gutter={8}
          style={{
            width: "100%",
            marginTop: 16,
            borderBottomStyle: "solid",
            borderBottomColor: "#ccc",
            borderBottomWidth: 1,
          }}
        >
          <Col span={5}>
            <Typography.Text strong={true}>User Tags</Typography.Text>
          </Col>
          <Col span={5}>
            <Typography.Text strong={true}>Model Tags</Typography.Text>
          </Col>
          <Col span={5}>
            <Typography.Text strong={true}>Source Tags</Typography.Text>
          </Col>
          <Col span={4}>
            <Typography.Text strong={true}>Type Tags</Typography.Text>
          </Col>
          <Col span={5}>
            <Typography.Text strong={true}>System Tags</Typography.Text>
          </Col>
        </Row>
        <Row style={{ marginTop: 8 }} gutter={8}>
          <Col span={5}>
            <Space size={4} direction={"vertical"} style={{ width: "100%" }}>
              {userTags}
            </Space>
          </Col>
          <Col span={5}>
            <Space size={4} direction={"vertical"} style={{ width: "100%" }}>
              {modelTags}
            </Space>
          </Col>
          <Col span={5}>
            <Space size={4} direction={"vertical"} style={{ width: "100%" }}>
              {sourceTags}
            </Space>
          </Col>
          <Col span={4}>
            <Space size={4} direction={"vertical"} style={{ width: "100%" }}>
              {typeTags}
            </Space>
          </Col>
          <Col span={5}>
            <Space size={4} direction={"vertical"} style={{ width: "100%" }}>
              {systemTags}
            </Space>
          </Col>
        </Row>
      </>
    );
  };

  return (
    <>
      <Row
        style={{
          marginTop: 16,
        }}
      >
        <Typography.Text strong={true}>Tags</Typography.Text>
      </Row>
      <Row>
        <Space.Compact>
          <Select
            style={{ width: 120 }}
            value={tagType}
            onSelect={(value) => {
              setTagType(value);
            }}
            options={[
              {
                value: "type",
                label: (
                  <Space size={8} direction={"horizontal"}>
                    <DesktopOutlined />
                    Type
                  </Space>
                ),
              },
              {
                value: "source",
                label: (
                  <Space size={8} direction={"horizontal"}>
                    <CloudOutlined />
                    Source
                  </Space>
                ),
              },
              {
                value: "model",
                label: (
                  <Space size={8} direction={"horizontal"}>
                    <UserOutlined />
                    Model
                  </Space>
                ),
              },
              {
                value: "system",
                label: (
                  <Space size={8} direction={"horizontal"}>
                    <SettingOutlined />
                    System
                  </Space>
                ),
              },
              {
                value: "user",
                label: (
                  <Space size={8} direction={"horizontal"}>
                    <UserOutlined />
                    User
                  </Space>
                ),
              },
            ]}
          ></Select>
          <AutoComplete
            placeholder={"tag"}
            style={{ width: 240 }}
            options={tagOptions}
            onSearch={filterTags}
            value={tagValue}
            onChange={(value) => {
              setTagValue(value);
            }}
            defaultActiveFirstOption={true}
          ></AutoComplete>
          <Button
            type={"primary"}
            icon={<PlusOutlined />}
            disabled={tagValue === undefined || tagValue.trim().length <= 0}
            loading={tagAddedLoading}
            onClick={async () => {
              setTagAddedLoading(true);

              try {
                await contentApi.addTagToAsset(
                  asset.id,
                  tagType,
                  tagValue!.trim(),
                );
                setTagsModified(true);
                setTagValue(undefined);
                setTagOptions([]);
                await fetchAssetTags(true);
                await fetchAvailableAssetTags();
              } finally {
                setTagAddedLoading(false);
              }
            }}
          >
            Add
          </Button>
        </Space.Compact>
      </Row>
      {assetTagsLoading ? <Spin spinning={true} /> : generateTags()}
    </>
  );
};
export default ContentAssetTagEditor;

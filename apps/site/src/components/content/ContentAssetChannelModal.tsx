import { CloseOutlined, StarFilled } from "@ant-design/icons";
import type {
  BaseContentAssetChannel,
  FullContentAssetChannel,
  ContentAssetChannelCategory,
  ContentAssetTag,
  ContentTagType,
  FilterDefinition,
} from "@ncfritz/olympus-sdk/dionysus";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Rate,
  Slider,
  Space,
  Typography,
} from "antd";
import React, { useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import contentApi from "../../api/contentApi";
import { publish } from "../../utils/events";
import { PUBLISH_EVENT } from "../common/NotificationSink";
import ContentAssetChannelPreviewPannel from "./ContentAssetChannelPreviewPannel";
import ContentAssetTagInput from "./ContentAssetTagInput";
import { RESOLUTION_MAP } from "./util";

export interface ContentAssetChannelModalProps {
  channelId?: string;
  category: ContentAssetChannelCategory;
  isOpen: boolean;
  initialData?: FormInput;
  close: () => void;
  onSuccess?: (channel: FullContentAssetChannel) => Promise<void>;
}

interface FormInput {
  name: string;
  description: string;
  bcCompliant: boolean;
  keyword: string;
  rating?: number;
  duration?: number[];
  quality?: number[];
  tags: string[];
}

export type ContentAssetChannelFormData = FormInput;

const ContentAssetChannelModal: React.FunctionComponent<
  ContentAssetChannelModalProps
> = ({
  channelId,
  category,
  initialData,
  isOpen,
  onSuccess,
  close,
}: ContentAssetChannelModalProps) => {
  const {
    handleSubmit,
    control,
    reset,
    getValues,
    formState: { isValid, isSubmitting },
  } = useForm<FormInput>({
    defaultValues: initialData
      ? initialData
      : {
          name: undefined,
          description: undefined,
          bcCompliant: false,
          keyword: undefined,
          rating: undefined,
          duration: undefined,
          quality: undefined,
          tags: [],
        },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const [selectedTags, setSelectedTags] = useState<
    ContentAssetTag[] | undefined
  >(undefined);
  const [preview, setPreview] = useState(false);

  const appendTagFilterDefinition = (
    tags: ContentAssetTag[],
    type: ContentTagType,
    logic: "and" | "or",
    chain: FilterDefinition[],
  ) => {
    const selectedValues = tags.filter((value) => value.type === type);

    if (selectedValues.length <= 0) {
      return;
    }

    if (logic === "and") {
      chain.push({
        type: "and",
        name: "__and",
        value: selectedValues.map<FilterDefinition>((value) => {
          return {
            type: "eq",
            name: "asset_tags.content_tag_id",
            value: value.id,
          };
        }),
      });
    } else {
      chain.push({
        type: "in",
        name: "asset_tags.content_tag_id",
        value: selectedValues.map((value) => value.id),
      });
    }
  };

  const buildChannelFilter = (data: FormInput) => {
    const filterChain: FilterDefinition[] = [];

    if (selectedTags) {
      appendTagFilterDefinition(selectedTags, "system", "and", filterChain);
      appendTagFilterDefinition(selectedTags, "user", "and", filterChain);
      appendTagFilterDefinition(selectedTags, "model", "or", filterChain);
      appendTagFilterDefinition(selectedTags, "source", "or", filterChain);
      appendTagFilterDefinition(selectedTags, "type", "or", filterChain);
    }

    if (data.rating) {
      filterChain.push({
        name: "rating",
        type: "gte",
        value: data.rating,
      });
    }

    if (data.keyword) {
      filterChain.push({
        name: "_or",
        type: "or",
        value: [
          {
            name: "original_name",
            type: "ilike",
            value: `%${data.keyword}%`,
          },
          {
            name: "name",
            type: "ilike",
            value: `%${data.keyword}%`,
          },
        ],
      });
    }

    if (data.duration) {
      filterChain.push({
        name: "_and",
        type: "and",
        value: [
          {
            name: "duration",
            type: "gte",
            value: data.duration[0] * 60 * 1000,
          },
          {
            name: "duration",
            type: "lte",
            value: data.duration[1] * 60 * 1000,
          },
        ],
      });
    }

    if (data.quality) {
      filterChain.push({
        name: "_and",
        type: "and",
        value: [
          {
            name: "height",
            type: "gte",
            value: RESOLUTION_MAP[data.quality[0]],
          },
          {
            name: "height",
            type: "lte",
            value: RESOLUTION_MAP[data.quality[1]],
          },
        ],
      });
    }

    if (filterChain.length <= 0) {
      return undefined;
    } else if (filterChain.length > 1) {
      return {
        type: "and",
        name: "__base",
        value: filterChain,
      } as FilterDefinition;
    } else {
      return filterChain[0];
    }
  };

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    try {
      const channelFilter = buildChannelFilter(data);
      const channel: BaseContentAssetChannel = {
        name: data.name,
        description: data.description,
        categoryId: category.id,
        bcCompliant: data.bcCompliant,
        favorite: false,
        filterInput: JSON.stringify(data),
        filterDefinition: channelFilter!,
      };

      let newOrUpdatedChannel: FullContentAssetChannel;

      if (channelId) {
        newOrUpdatedChannel = (
          await contentApi.updateContentAssetChannel(channelId, channel)
        ).data.channel;
      } else {
        newOrUpdatedChannel = (
          await contentApi.createContentAssetChannel(channel)
        ).data.channel;
      }

      publish(PUBLISH_EVENT, {
        type: "success",
        message: channelId ? "Category updated" : "Category created",
        description: channelId
          ? "Content channel category successfully updated"
          : "Content channel category successfully created",
      });

      if (onSuccess) {
        await onSuccess(newOrUpdatedChannel);
      }

      closeModal();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Unable to create category",
        description: "The API call to /v1/content/channels/categories failed",
      });
    }
  };

  const closeModal = () => {
    reset();
    setPreview(false);
    setSelectedTags(undefined);
    close();
  };

  const filterFormContent = (
    <>
      <Typography.Title level={5} style={{ marginBottom: 0, marginTop: 16 }}>
        Channel Filters
      </Typography.Title>
      <Alert
        type={"info"}
        style={{ borderRadius: 8 }}
        banner={true}
        description={
          <Typography.Text style={{ fontSize: "11px" }}>
            All tag filters are applied as logical OR, except for "System" and
            "User" which are applied as logical AND. The entire set of filters
            is applied as a logical AND.
          </Typography.Text>
        }
      />
      <Space
        size={4}
        direction={"horizontal"}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "stretch",
          borderTop: "1px solid #efefef",
        }}
      >
        <Space
          size={8}
          direction={"vertical"}
          style={{
            width: 300,
            alignContent: "start",
            paddingTop: 16,
          }}
        >
          <Controller
            name={"keyword"}
            control={control}
            render={({ field, fieldState }) => (
              <Form.Item
                layout={"vertical"}
                label={"Keyword"}
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error ? fieldState.error.message : undefined}
              >
                <Input {...field} placeholder={"Keyword"} allowClear={true} />
              </Form.Item>
            )}
          />
          <Typography.Text strong={true} style={{ fontSize: "13px" }}>
            Rating
          </Typography.Text>
          <Controller
            name={"rating"}
            control={control}
            render={({ field, fieldState }) => (
              <Rate
                defaultValue={field.value}
                count={5}
                allowHalf={true}
                allowClear={true}
                character={<StarFilled size={12} />}
                onChange={(value) => {
                  field.onChange(value);
                }}
              />
            )}
          />
          <Typography.Text strong={true} style={{ fontSize: "13px" }}>
            Duration
          </Typography.Text>
          <Controller
            name={"duration"}
            control={control}
            render={({ field, fieldState }) => (
              <Slider
                range={true}
                marks={{
                  1: "1m",
                  30: "30m",
                  60: "1h",
                  90: "1h30m",
                  120: "2h",
                  180: "3h",
                }}
                defaultValue={[0, 180]}
                value={field.value}
                min={0}
                max={180}
                onChange={(value: number[]) => {
                  field.onChange([value[0], value[1]]);
                }}
              />
            )}
          />
          <Typography.Text strong={true} style={{ fontSize: "13px" }}>
            Quality
          </Typography.Text>
          <Controller
            name={"quality"}
            control={control}
            render={({ field, fieldState }) => (
              <Slider
                range={true}
                marks={{
                  0: "All",
                  1: "SD",
                  2: "HD",
                  3: "FHD",
                  4: "QHD",
                  5: "2K",
                  6: "4K",
                }}
                defaultValue={[0, 6]}
                value={field.value}
                min={0}
                max={6}
                step={1}
                onChange={(value: number[]) => {
                  field.onChange([value[0], value[1]]);
                }}
              />
            )}
          />
        </Space>
        <div
          style={{
            height: 550,
            overflow: "hidden",
            marginLeft: 24,
            paddingLeft: 24,
            paddingTop: 16,
            borderLeft: "1px solid #efefef",
          }}
        >
          <Controller
            name={"tags"}
            control={control}
            render={({ field, fieldState }) => (
              <ContentAssetTagInput
                defaultValue={
                  initialData && !selectedTags
                    ? initialData.tags
                    : selectedTags?.map((tag) => tag.id)
                }
                allowAdd={false}
                onChange={(tags) => {
                  setSelectedTags(tags);
                  field.onChange(tags.map((tag) => tag.id));
                }}
                titleStyle={{ fontSize: "13px" }}
              />
            )}
          />
        </div>
      </Space>
    </>
  );

  const previewContent = (
    <Space direction={"vertical"} style={{ height: 640, width: "100%" }}>
      <Space
        direction={"horizontal"}
        size={0}
        style={{
          width: "100%",
          justifyContent: "space-between",
          alignItems: "end",
        }}
      >
        <Typography.Title level={5} style={{ marginBottom: 0, marginTop: 16 }}>
          Channel Preview
        </Typography.Title>
        <Button
          type={"text"}
          size={"small"}
          icon={<CloseOutlined />}
          onClick={() => setPreview(false)}
        />
      </Space>
      <Space
        size={4}
        direction={"horizontal"}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "stretch",
          borderTop: "1px solid #efefef",
          paddingTop: 16,
        }}
        styles={{ item: { width: "100%" } }}
      >
        <ContentAssetChannelPreviewPannel
          filters={buildChannelFilter(getValues())}
        />
      </Space>
    </Space>
  );

  return (
    <Modal
      title={channelId ? "Update Channel" : "Create New Channel"}
      open={isOpen}
      width={"1624px"}
      destroyOnHidden={true}
      footer={() => {
        return (
          <Space
            size={8}
            direction={"horizontal"}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Button type={"primary"} danger={true} onClick={closeModal}>
              Cancel
            </Button>
            <Space size={8} direction={"horizontal"}>
              {!preview && (
                <Button
                  color={"magenta"}
                  variant={"text"}
                  disabled={isSubmitting}
                  onClick={async () => {
                    setPreview(true);
                  }}
                >
                  Preview Category
                </Button>
              )}
              {preview && (
                <Button
                  color={"red"}
                  variant={"text"}
                  disabled={isSubmitting}
                  onClick={async () => {
                    setPreview(false);
                  }}
                >
                  Hide Ctegory Preview
                </Button>
              )}
              <Button
                htmlType={"submit"}
                type={"primary"}
                disabled={!isValid && !isSubmitting}
                onClick={async () => {
                  await handleSubmit(onSubmit)();
                }}
              >
                {channelId ? "Update Channel" : "Create Channel"}
              </Button>
            </Space>
          </Space>
        );
      }}
      onCancel={() => {
        closeModal();
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Space direction={"vertical"} style={{ width: "100%" }}>
          <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
            <Controller
              name={"name"}
              control={control}
              rules={{
                required: "Name must be specified",
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  layout={"vertical"}
                  label={"Name"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input {...field} placeholder={"Name"} allowClear={true} />
                </Form.Item>
              )}
            />
            <Controller
              name={"description"}
              control={control}
              rules={{
                required: "Name must be specified",
              }}
              render={({ field, fieldState }) => (
                <Form.Item
                  layout={"vertical"}
                  label={"Description"}
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error ? fieldState.error.message : undefined}
                >
                  <Input.TextArea
                    {...field}
                    placeholder={"Description"}
                    allowClear={true}
                  />
                </Form.Item>
              )}
            />
          </Space>
          {preview ? previewContent : filterFormContent}
        </Space>
      </form>
    </Modal>
  );
};
export default ContentAssetChannelModal;

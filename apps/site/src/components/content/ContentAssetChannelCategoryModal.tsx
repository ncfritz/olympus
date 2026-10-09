import type { FullContentAssetChannelCategory } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Form, Input, Modal, Space } from "antd";
import React from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import contentApi from "../../api/contentApi";
import { Events, publish } from "../../utils/events";

export interface ContentAssetChannelCategoryModalProps {
  categoryId?: string;
  isOpen: boolean;
  initialData?: FormInput;
  onSuccess?: (category: FullContentAssetChannelCategory) => Promise<void>;
  close: () => void;
}

interface FormInput {
  name: string;
}

export type ContentAssetChannelCategoryFormData = FormInput;

const ContentAssetChannelCategoryModal: React.FunctionComponent<
  ContentAssetChannelCategoryModalProps
> = ({
  categoryId,
  isOpen,
  initialData,
  onSuccess,
  close,
}: ContentAssetChannelCategoryModalProps) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { isValid, isSubmitting, isDirty },
  } = useForm<FormInput>({
    defaultValues: initialData
      ? initialData
      : {
          name: undefined,
        },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    try {
      const categoryBody = {
        name: data.name,
      };
      let createdOrUpdatedCategory;

      if (categoryId) {
        createdOrUpdatedCategory = (
          await contentApi.updateContentAssetChannelCategory(
            categoryId,
            categoryBody,
          )
        ).data.category;
      } else {
        createdOrUpdatedCategory = (
          await contentApi.createContentAssetChannelCategory(categoryBody)
        ).data.category;
      }

      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "success",
        message: categoryId ? "Category updated" : "Category created",
        description: categoryId
          ? "Content channel category successfully updated"
          : "Content channel category successfully created",
      });

      if (onSuccess) {
        await onSuccess(createdOrUpdatedCategory);
      }

      closeModal();
    } catch {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Unable to create category",
        description: "The API call to /v1/content/channels/categories failed",
      });
    }
  };

  const closeModal = () => {
    close();
    reset();
  };

  return (
    <Modal
      title={categoryId ? "Update category" : "Create new category"}
      destroyOnHidden={true}
      open={isOpen}
      width={700}
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
              <Button
                htmlType={"submit"}
                type={"primary"}
                disabled={!isDirty && !isValid && !isSubmitting}
                onClick={async () => {
                  await handleSubmit(onSubmit)();
                }}
              >
                {categoryId ? "Update Category" : "Create Category"}
              </Button>
            </Space>
          </Space>
        );
      }}
      onCancel={() => {
        close();
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Space
          size={4}
          direction={"vertical"}
          style={{ width: "100%" }}
          styles={{ item: { width: "100%" } }}
        >
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
        </Space>
      </form>
    </Modal>
  );
};
export default ContentAssetChannelCategoryModal;

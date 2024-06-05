import {
  CloseOutlined,
  FlagFilled,
  FlagOutlined,
  SaveFilled,
} from "@ant-design/icons";
import { Button, Form, Input, Radio, Space } from "antd";
import React, { type CSSProperties } from "react";
import {
  type Control,
  Controller,
  type SubmitHandler,
  type UseFormHandleSubmit,
  type UseFormReset,
} from "react-hook-form";
import notesApi from "../../api/notestApi";
import { publish } from "../../utils/events";
import {
  getColorForType,
  getIconForType,
  getSecondaryColorForType,
} from "../../utils/notes";
import { PUBLISH_EVENT } from "../common/NotificationSink";
import NoteRichTextEditor from "./NoteRitchTextEditor";
import { v4 as uuidv4 } from "uuid";
import NoteSummaryRichTextEditor from "./NoteSummaryRitchTextEditor";

class Note {}

export enum AdditionalInfoPosition {
  TOP,
  BOTTOM,
}

export interface NotesEditorFormProps {
  onClose: () => void;
  beforeCreate?: (toCreate: NotesFormInput) => NotesFormInput;
  afterCreate?: (created: Note) => Promise<void>;
  afterUpdate?: (updated: Note) => Promise<void>;
  noteId?: string;
  formControl: {
    handleSubmit: UseFormHandleSubmit<NotesFormInput>;
    control: Control<NotesFormInput>;
    reset: UseFormReset<NotesFormInput>;
  };
  showAdditionalInfo?: boolean;
  showTitle?: boolean;
  showSummary?: boolean;
  additionalInfoPosition?: AdditionalInfoPosition;
  style?: CSSProperties;
}

export interface NotesFormInput {
  author: string;
  type: number;
  flagged: boolean;
  title?: string;
  summary?: string;
  value: string;
  associations: any[];
}

export const NEW_NOTE: NotesFormInput = {
  author: "ncfritz",
  type: 0,
  flagged: false,
  title: undefined,
  summary: undefined,
  value: "",
  associations: [],
};

const NotesEditorForm: React.FunctionComponent<NotesEditorFormProps> = ({
  onClose,
  beforeCreate,
  afterCreate,
  afterUpdate,
  noteId,
  formControl,
  showAdditionalInfo = true,
  showTitle = true,
  showSummary = true,
  additionalInfoPosition = AdditionalInfoPosition.BOTTOM,
  style = {},
}: NotesEditorFormProps) => {
  const onSubmit: SubmitHandler<NotesFormInput> = async (data) => {
    try {
      if (noteId) {
        const updateResponse = await notesApi.updateNote(noteId, data);

        if (afterUpdate) {
          await afterUpdate(updateResponse.data.note);
        }

        publish("notes:noteUpdated");
        publish(PUBLISH_EVENT, {
          type: "success",
          message: "Note saved",
          description: "The note has been successfully updated",
        });
      } else {
        let candidate = data;

        if (beforeCreate) {
          candidate = beforeCreate(candidate);
        }

        if (!candidate.associations) {
          candidate.associations = [];
        }

        const createResponse = await notesApi.createNote(candidate);

        if (afterCreate) {
          await afterCreate(createResponse.data.note);
        }

        publish("notes:noteAdded");

        publish(PUBLISH_EVENT, {
          type: "success",
          message: "Note saved",
          description: "The note has been successfully created",
        });
      }
      formControl.reset(NEW_NOTE);
      onClose();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save note",
        description: "Unable to save note due to a server error",
      });
    }
  };

  const title = (
    <Space
      style={{
        paddingLeft: 20,
        paddingRight: 20,
        width: "100%",
      }}
      styles={{
        item: {
          width: "100%",
        },
      }}
    >
      <Controller
        name={"title"}
        control={formControl.control}
        render={({ field, fieldState }) => (
          <Form.Item
            label={"Title"}
            validateStatus={fieldState.error ? "error" : undefined}
            help={fieldState.error ? fieldState.error.message : undefined}
          >
            <Input {...field} placeholder={"Note title"} allowClear={true} />
          </Form.Item>
        )}
      />
    </Space>
  );

  const editor = (
    <Controller
      name={"value"}
      control={formControl.control}
      rules={{
        required: "A value must be specified",
      }}
      render={({ field: { onChange, value } }) => (
        <NoteRichTextEditor onChange={onChange} value={value} height={400} />
      )}
    />
  );

  const summaryEditor = (
    <Controller
      name={"summary"}
      control={formControl.control}
      render={({ field: { onChange, value } }) => (
        <NoteSummaryRichTextEditor
          onChange={onChange}
          value={value}
          height={200}
        />
      )}
    />
  );

  const additionalDataControls = (
    <Space
      style={{
        paddingLeft: 20,
        paddingRight: 20,
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <Controller
        name={"type"}
        control={formControl.control}
        rules={{
          required: "A value must be specified",
        }}
        render={({ field, fieldState }) => (
          <Form.Item
            label={"Type"}
            validateStatus={fieldState.error ? "error" : undefined}
            help={fieldState.error ? fieldState.error.message : undefined}
          >
            <Radio.Group {...field} defaultValue={field.value}>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                return (
                  <Radio.Button
                    id={uuidv4()}
                    value={i}
                    style={{
                      color:
                        field.value === i
                          ? getSecondaryColorForType(i)
                          : getColorForType(i),
                      backgroundColor:
                        field.value === i ? getColorForType(i) : "#ffffff",
                    }}
                  >
                    {getIconForType(i)}
                  </Radio.Button>
                );
              })}
            </Radio.Group>
          </Form.Item>
        )}
      />
      <Controller
        name={"flagged"}
        control={formControl.control}
        render={({ field, fieldState }) => (
          <Form.Item
            label={"Flagged"}
            validateStatus={fieldState.error ? "error" : undefined}
            help={fieldState.error ? fieldState.error.message : undefined}
          >
            <Button
              icon={field.value ? <FlagFilled /> : <FlagOutlined />}
              style={{
                border: 0,
                boxShadow: "none",
                color: "#cc0000",
              }}
              onClick={async () => {
                field.onChange(field.value !== true);
              }}
            />
          </Form.Item>
        )}
      />
    </Space>
  );

  return (
    <Space direction={"vertical"} style={{ width: "100%", ...style }}>
      {showAdditionalInfo &&
        additionalInfoPosition === AdditionalInfoPosition.TOP &&
        additionalDataControls}
      {showTitle && title}
      {showSummary && summaryEditor}
      {editor}
      {showAdditionalInfo &&
        additionalInfoPosition === AdditionalInfoPosition.BOTTOM &&
        additionalDataControls}
      <Space
        size={8}
        style={{ justifyContent: "end", padding: 20, width: "100%" }}
      >
        <Button
          type={"primary"}
          onClick={() => {
            formControl.handleSubmit(onSubmit)();
          }}
          icon={<SaveFilled />}
        >
          Save
        </Button>
        <Button
          type={"primary"}
          danger={true}
          onClick={() => {
            formControl.reset(NEW_NOTE);
            onClose();
          }}
          icon={<CloseOutlined />}
        >
          Cancel
        </Button>
      </Space>
    </Space>
  );
};
export default NotesEditorForm;

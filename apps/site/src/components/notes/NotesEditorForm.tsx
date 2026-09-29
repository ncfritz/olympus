import {
  CloseOutlined,
  FlagFilled,
  FlagOutlined,
  SaveFilled,
} from "@ant-design/icons";
import type {
  PartialNoteAssociation,
  NoteType,
  SingleNoteResponse,
} from "@ncfritz/olympus-sdk/minerva";
import { Button, Form, Input, Radio, Space } from "antd";
import React, { type CSSProperties, useEffect } from "react";
import {
  type Control,
  Controller,
  type SubmitHandler,
  type UseFormHandleSubmit,
  type UseFormReset,
} from "react-hook-form";
import notesApi from "../../api/notestApi";
import { Events, publish } from "../../utils/events";
import {
  getColorForType,
  getIconForType,
  getSecondaryColorForType,
} from "../../utils/notes";
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
  parentId?: string;
  formControl: {
    handleSubmit: UseFormHandleSubmit<NotesFormInput>;
    control: Control<NotesFormInput>;
    reset: UseFormReset<NotesFormInput>;
  };
  mainEditorHeight?: number;
  showAdditionalInfo?: boolean;
  showTitle?: boolean;
  showSummary?: boolean;
  showCancelButton?: boolean;
  summaryEditorHeight?: number;
  additionalInfoPosition?: AdditionalInfoPosition;
  style?: CSSProperties;
  className?: string;
  buttonsPosition?: "left" | "right";
}

export interface NotesFormInput {
  author: string;
  type: NoteType;
  flagged: boolean;
  title?: string;
  summary?: string;
  value: string;
  associations: PartialNoteAssociation[];
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
  parentId,
  formControl,
  mainEditorHeight = 400,
  showAdditionalInfo = true,
  showTitle = true,
  showSummary = true,
  summaryEditorHeight = 200,
  showCancelButton = true,
  additionalInfoPosition = AdditionalInfoPosition.BOTTOM,
  style = {},
  className,
  buttonsPosition = "right",
}: NotesEditorFormProps) => {
  // This prevents Antd from stealing focus from TinyMCE
  // https://stackoverflow.com/questions/17271634/tinymce-modal-in-jquery-modal-not-editable
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(".tox-tinymce-aux, .tox-dialog")
      ) {
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener("focusin", handleFocusIn, true);
    return () => document.removeEventListener("focusin", handleFocusIn, true);
  }, []);

  const onSubmit: SubmitHandler<NotesFormInput> = async (data) => {
    try {
      if (noteId) {
        const updateResponse = (await notesApi.updateNote(noteId, data)).data;

        if (afterUpdate) {
          await afterUpdate(updateResponse.note);
        }

        publish(Events.MINERVA_NOTE_UPDATED);
        publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
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

        let createResponse: SingleNoteResponse;

        if (parentId) {
          createResponse = (await notesApi.createChildNote(candidate, parentId))
            .data;
        } else {
          createResponse = (await notesApi.createNote(candidate)).data;
        }

        const createdNote = createResponse.note;

        if (afterCreate) {
          await afterCreate(createdNote);
        }

        publish(Events.MINERVA_NOTE_ADDED, { note: createdNote });

        publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
          type: "success",
          message: "Note saved",
          description: "The note has been successfully created",
        });
      }
      formControl.reset(NEW_NOTE);
      onClose();
    } catch (e) {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save note",
        description: "Unable to save note due to a server error",
      });
      console.log(e);
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

  const summaryEditor = (
    <Controller
      name={"summary"}
      control={formControl.control}
      render={({ field: { onChange, value } }) => (
        <NoteSummaryRichTextEditor
          onChange={onChange}
          value={value || ""}
          height={summaryEditorHeight}
        />
      )}
    />
  );

  const editor = (
    <Controller
      name={"value"}
      control={formControl.control}
      rules={{
        required: "A value must be specified",
      }}
      render={({ field: { onChange, value } }) => (
        <NoteRichTextEditor
          onChange={onChange}
          value={value || ""}
          height={mainEditorHeight}
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
                    key={`nef-rg-type-${i}`}
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
    <Space
      direction={"vertical"}
      className={`minerva-editor${className ? " " + className : ""}`}
      style={{ width: "100%", ...style }}
    >
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
        style={{
          justifyContent: buttonsPosition === "left" ? "start" : "end",
          padding: 20,
          width: "100%",
        }}
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
        {showCancelButton && (
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
        )}
      </Space>
    </Space>
  );
};
export default NotesEditorForm;

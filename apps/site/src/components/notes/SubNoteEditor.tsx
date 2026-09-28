import { EditOutlined } from "@ant-design/icons";
import type { Note } from "@ncfritz/olympus-sdk/minerva";
import { Space } from "antd";
import type { CSSProperties } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import NotesEditorForm, {
  NEW_NOTE,
  type NotesFormInput,
} from "./NotesEditorForm";

export interface SubNoteEditorProps {
  parentId: string;
  level?: number;
  childrenPresent?: boolean;
  onClose: () => void;
  createCallback: (note: Note) => Promise<void>;
  updateCallback: (entry: Note) => Promise<void>;
}

const SubNoteEditor: React.FunctionComponent<SubNoteEditorProps> = ({
  parentId,
  level = 0,
  childrenPresent,
  onClose,
  createCallback,
  updateCallback,
}: SubNoteEditorProps) => {
  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: NEW_NOTE,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const style: CSSProperties = {
    marginLeft: 66,
    borderLeft: "1px solid #efefef",
    paddingLeft: 8,
    width: `calc(100% - ${146 - (level - 1) * 27}px)`,
  };

  if (!childrenPresent) {
    style.borderImage =
      "linear-gradient(to bottom, #efefef 32px, #ffffff 32px)";
    style.borderImageSlice = 1;
  }

  return (
    <div
      style={{
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          left: -55,
        }}
      >
        <Space
          direction={"horizontal"}
          style={{ whiteSpace: "nowrap" }}
          size={0}
        >
          <div
            style={{
              position: "relative",
              top: 16,
              border: "1px solid #cccccc",
              padding: 8,
              borderRadius: 16,
              left: 32,
              background: "#ffffff",
            }}
          >
            <EditOutlined />
          </div>
          <Space
            style={{
              width: 16,
              height: 4,
              borderTop: "2px solid #efefef",
              position: "relative",
              top: 16,
              left: 32,
            }}
          >
            &nbsp;
          </Space>
        </Space>
        <Space
          style={{
            marginLeft: 32,
            marginTop: 8,
            border: "1px solid #e6e6e6",
            borderRadius: 4,
            width: `calc(100% - 80px)`,
          }}
          styles={{ item: { width: "100%" } }}
        >
          <NotesEditorForm
            className={"contained"}
            style={{
              borderRadius: 4,
              width: "100%",
            }}
            onClose={() => {
              onClose();
            }}
            afterCreate={createCallback}
            afterUpdate={updateCallback}
            parentId={parentId}
            showTitle={false}
            showSummary={false}
            mainEditorHeight={250}
            formControl={{
              control: control,
              reset: reset,
              handleSubmit: handleSubmit,
            }}
          />
        </Space>
      </div>
    </div>
  );
};
export default SubNoteEditor;

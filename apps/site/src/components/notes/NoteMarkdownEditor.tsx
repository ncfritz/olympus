import type { Note } from "@ncfritz/olympus-sdk/minerva";
import { Button, Form, Radio } from "antd";
import { useState } from "react";
import * as React from "react";

import MdEditor from "react-markdown-editor-lite";
import Markdown from "react-markdown";
import { getIconForType } from "../../utils/notes";

export interface NoteMarkdownEditorProps {
  entry: Note;
  closeAction?: () => void;
  saveCallback: () => Promise<void>;
  noteSaving: boolean;
}

const NoteMarkdownEditor: React.FunctionComponent = ({
  entry,
  closeAction,

  noteSaving,
}: NoteMarkdownEditorProps) => {
  //const dispatch = useDispatch();

  const [, setType] = useState(0);
  const [flagged, setFlagged] = useState(false);
  const [value, setValue] = useState("");

  const renderHTML = (text: string) => {
    return <Markdown>{text}</Markdown>;
  };

  const handleToggleFlagged = () => {
    setFlagged(!flagged);
  };

  const handleClose = () => {
    if (closeAction) {
      closeAction();
    }
  };

  const handleSave = () => {
    /*dispatch(
      saveNote(
        {
          type: type,
          value: value,
          flagged: flagged,
        },
        entry.id,
        saveCallback,
      ),
    );*/
  };

  return (
    <div className={"notes-editor"}>
      <MdEditor
        style={{ height: "450px", width: "100%" }}
        value={entry && entry.value ? entry.value : ""}
        renderHTML={renderHTML}
        config={{
          view: {
            menu: true,
            md: true,
            html: true,
            hideMenu: false,
          },
          canView: {
            menu: true,
            md: true,
            html: true,
            fullScreen: false,
          },
          table: {},
          imageUrl: "https://",
          syncScrollMode: ["leftFollowRight", "rightFollowLeft"],
        }}
        onChange={(html) => setValue(html.text)}
      />
      <div className={"notes-editor-bottom-toolbar"}>
        <div className={"notes-editor-note-type"}>
          <Form.Item label="Note Type">
            <Radio.Group
              onChange={(e) => {
                setType(e.target.value);
              }}
            >
              {Array.from(Array(6).keys()).map((i) => (
                <Radio.Button className={"type-0"} value={0}>
                  {getIconForType(i)}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </div>
        <div className={"notes-editor-note-flagged"}>
          <Form.Item label="Flagged">
            <Button
              icon={"flag"}
              className={"flag"}
              onClick={handleToggleFlagged}
            />
          </Form.Item>
        </div>
        <div className={"notes-editor-note-actions"}>
          <Button danger={true} icon={"cross"} onClick={handleClose}>
            Close
          </Button>
          <Button
            type={"primary"}
            icon={"floppy-disk"}
            onClick={handleSave}
            loading={noteSaving}
            disabled={!value}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
export default NoteMarkdownEditor;

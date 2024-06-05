import {
  ClearOutlined,
  DeleteFilled,
  EditOutlined,
  FlagFilled,
  FlagOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { Badge, Button, Popover, Space } from "antd";
import { useState } from "react";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";
import notesApi from "../../api/notestApi";
import { publish } from "../../utils/events";
import { config, getIconForType, type Note } from "../../utils/notes";
import { PUBLISH_EVENT } from "../common/NotificationSink";

export interface NotesTimelineEntryTypeProps {
  entry: Note;
  editing: boolean;
  afterDelete?: (entry: Note, isPermanent: boolean) => Promise<void>;
  afterRestore?: (entry: Note) => Promise<void>;
  afterUpdateFlag?: (entry: Note) => Promise<void>;
  editNoteCallback: () => void;
}

const NotesTimelineEntryType: React.FunctionComponent<
  NotesTimelineEntryTypeProps
> = ({
  entry,
  editing,
  afterDelete,
  afterRestore,
  afterUpdateFlag,
  editNoteCallback,
}: NotesTimelineEntryTypeProps) => {
  const [open, setOpen] = useState(false);

  const closeMenu = () => {
    setOpen(false);
  };

  const handleDeleteNote = async (entry: Note) => {
    const response = await notesApi.deleteNote(entry.id);

    if (afterDelete) {
      if (response.status === 204) {
        await afterDelete(entry, true);
      } else {
        await afterDelete(response.data.note, false);
      }
    }

    if (response.status === 204) {
      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Note deleted",
        description:
          "The note has been marked as deleted.  You can restore the note",
      });
    } else {
      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Note deleted",
        description:
          "The note has been permanently deleted and cannot be recovered",
      });
    }

    closeMenu();
  };

  const handleRestoreNote = async (entry: Note) => {
    const response = await notesApi.restoreNote(entry.id);

    if (afterRestore) {
      await afterRestore(response.data.note);
    }

    publish(PUBLISH_EVENT, {
      type: "success",
      message: "Note restored",
      description: "The note has been restored successfully",
    });

    closeMenu();
  };

  const handleFlagNote = async (entry: Note) => {
    const response = await notesApi.updateNote(entry.id, {
      flagged: !entry.flagged,
    });

    if (afterUpdateFlag) {
      await afterUpdateFlag(response.data.note);
    }

    publish(PUBLISH_EVENT, {
      type: "success",
      message: "Note updated",
      description: `The note flag has been ${response.data.note.flagged ? "set" : "removed"} successfully`,
    });

    closeMenu();
  };

  const deleteIcon = [];

  if (entry.deletedTime) {
    deleteIcon.push(
      <Button
        key={uuidv4()}
        type={"text"}
        icon={<UndoOutlined />}
        className={"action-restore"}
        onClick={async () => {
          await handleRestoreNote(entry);
          setOpen(false);
        }}
      />,
    );
    deleteIcon.push(
      <Button
        key={uuidv4()}
        type={"text"}
        danger={true}
        icon={<ClearOutlined />}
        className={"action-delete"}
        onClick={async () => {
          await handleDeleteNote(entry);
          setOpen(false);
        }}
      />,
    );
  } else {
    deleteIcon.push(
      <Button
        key={uuidv4()}
        type={"text"}
        danger={true}
        icon={<DeleteFilled />}
        className={"action-delete"}
        onClick={async () => {
          await handleDeleteNote(entry);
          setOpen(false);
        }}
      />,
    );
  }

  const typeButton = (
    <Button
      icon={getIconForType(entry.type)}
      onClick={closeMenu}
      style={{
        border: "1px solid #cccccc",
        padding: 8,
        borderRadius: 20,
        color: config[entry.type].color,
        backgroundColor: config[entry.type].backgroundColor,
        display: "flex",
        alignItems: "center",
        alignContent: "center",
      }}
    />
  );

  return (
    <Popover
      placement={"bottom"}
      open={open}
      onOpenChange={(visible) => {
        setOpen(visible);
      }}
      trigger={"click"}
      content={
        <Space size={8} direction={"vertical"}>
          <Button
            type={"text"}
            icon={<EditOutlined />}
            onClick={() => {
              editNoteCallback();
              setOpen(false);
            }}
            disabled={editing}
          />
          <Button
            type={"text"}
            icon={entry.flagged ? <FlagFilled /> : <FlagOutlined />}
            onClick={async () => {
              await handleFlagNote(entry);
              setOpen(false);
            }}
            disabled={editing}
          />
          {deleteIcon}
        </Space>
      }
    >
      <Badge
        count={entry.flagged ? <FlagFilled /> : 0}
        showZero={false}
        size={"small"}
        style={{
          color: "#ee0000",
        }}
      >
        <Badge
          count={entry.deletedTime ? <DeleteFilled /> : 0}
          showZero={false}
          size={"small"}
          style={{
            color: "#333333",
            top: 28,
          }}
        >
          {typeButton}
        </Badge>
      </Badge>
    </Popover>
  );
};
export default NotesTimelineEntryType;

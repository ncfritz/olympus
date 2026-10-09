import {
  ClearOutlined,
  DeleteFilled,
  EditOutlined,
  FlagFilled,
  FlagOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { Note } from "@ncfritz/olympus-sdk/minerva";
import { Badge, Button, Popover, Space } from "antd";
import { useRef, useState } from "react";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";
import notesApi from "../../api/notestApi";
import { Events, publish } from "../../utils/events";
import { config, getIconForType } from "../../utils/notes";

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
  const buttonRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);

  const closeMenu = () => {
    setOpen(false);
  };

  const handleDeleteNote = async (entry: Note) => {
    const response = await notesApi.deleteNote(entry.id);

    if (afterDelete) {
      if (response.status === 204) {
        await afterDelete(entry, true);
      } else if (response.data?.note) {
        await afterDelete(response.data.note, false);
      }
    }

    if (response.status === 204) {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "success",
        message: "Note deleted",
        description:
          "The note has been permanently deleted and cannot be recovered",
      });
    } else {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "success",
        message: "Note deleted",
        description:
          "The note has been marked as deleted.  You can restore the note",
      });
    }

    closeMenu();
  };

  const handleRestoreNote = async (entry: Note) => {
    const response = await notesApi.restoreNote(entry.id);

    if (afterRestore) {
      await afterRestore(response.data.note);
    }

    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
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

    publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
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
        border: open ? "none" : "1px solid #cccccc",
        padding: 8,
        borderRadius: 20,
        color: config[entry.type].color,
        backgroundColor: open
          ? `${config[entry.type].color}20`
          : config[entry.type].secondaryColor,
        display: "flex",
        alignItems: "center",
        alignContent: "center",
        zIndex: 100,
      }}
    />
  );

  return (
    <div ref={buttonRef}>
      <Popover
        classNames={{ root: "pill" }}
        placement={"bottom"}
        open={open}
        getPopupContainer={() => buttonRef.current!}
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
        zIndex={1}
      >
        <Badge
          count={entry.flagged ? <FlagFilled /> : 0}
          showZero={false}
          size={"small"}
          style={{
            color: "#ee0000",
            zIndex: 100,
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
    </div>
  );
};
export default NotesTimelineEntryType;

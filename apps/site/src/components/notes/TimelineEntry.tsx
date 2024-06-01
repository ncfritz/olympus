import {
  CaretDownOutlined,
  CaretRightOutlined,
  ClockCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { Button, Collapse, Space, Typography } from "antd";
import { DateTime } from "luxon";
import { type CSSProperties, useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { config, type Note } from "../../utils/notes";
import NoteAssociations from "./NoteAssociations";
import NoteHtmlDisplay from "./NoteHtmlDisplay";
import NotesEditorForm, { type NotesFormInput } from "./NotesEditorForm";
import NotesTimelineEntryType from "./TimelineEntryTypeIcon";

export interface TimelineEntryProps {
  item: Note;
  showMetadata: boolean;
  showEditorTitle?: boolean;
  showEditorSummary?: boolean;
  showAssociations?: boolean;
  deleteCallback: (entry: Note, isPermanent: boolean) => Promise<void>;
  restoreCallback: (entry: Note) => Promise<void>;
  updateCallback: (entry: Note) => Promise<void>;
  updateFlagCallback: (entry: Note) => Promise<void>;
  leftMargin?: number;
  rightMargin?: number;
}

const TimelineEntry: React.FunctionComponent<TimelineEntryProps> = ({
  item,
  showMetadata,
  showEditorTitle = true,
  showEditorSummary = true,
  showAssociations = true,
  deleteCallback,
  restoreCallback,
  updateCallback,
  updateFlagCallback,
  leftMargin = 40,
}: TimelineEntryProps) => {
  const [editing, setEditing] = useState(false);
  const [entryOpen, setEntryOpen] = useState(true);

  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: {
      author: item.author,
      type: item.type,
      flagged: item.flagged,
      title: item.title,
      summary: item.summary,
      value: item.value,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const gradientRight = item.deletedTime ? "#cc0000" : "#ffffff";
  const createdTime = DateTime.fromISO(item.createdTime);
  const modifiedTime = DateTime.fromISO(item.lastUpdatedTime);
  const deletedTime = item.deletedTime
    ? DateTime.fromISO(item.deletedTime)
    : undefined;

  const toggleOpen = () => {
    if (editing) {
      return;
    }

    setEntryOpen(!entryOpen);
  };

  let noteContent;
  const noteStyle: CSSProperties = {
    padding: 8,
  };

  if (!entryOpen) {
    noteStyle.overflow = "hidden";
    noteStyle.height = 46;
  }

  if (editing) {
    noteContent = (
      <NotesEditorForm
        noteId={item.id}
        onClose={() => {
          setEditing(false);
        }}
        afterUpdate={updateCallback}
        formControl={{
          control: control,
          reset: reset,
          handleSubmit: handleSubmit,
        }}
        showTitle={showEditorTitle}
        showSummary={showEditorSummary}
        style={{ paddingTop: 20 }}
      />
    );
  } else {
    noteContent = (
      <Space
        style={{
          width: "100%",
          borderRight: `6px solid ${config[item.type].color}`,
          borderRadius: 4,
        }}
        direction={"vertical"}
      >
        {(showMetadata || item.title) && (
          <Space
            style={{
              width: "100%",
              backgroundColor: "#f5f5f5",
              padding: 6,
              justifyContent: "space-between",
            }}
          >
            <Typography.Text
              style={{
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {item.title}
            </Typography.Text>
            {showMetadata && (
              <Typography.Text
                copyable={true}
                style={{
                  fontFamily: "monospace",
                  fontSize: "11px",
                }}
              >
                <Typography.Text
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                  strong={true}
                >
                  ID:
                </Typography.Text>
                &nbsp;
                {item.id}
              </Typography.Text>
            )}
          </Space>
        )}
        <Space
          direction={"vertical"}
          style={noteStyle}
          className={entryOpen ? "" : "collapsed"}
        >
          {item.summary && (
            <Space direction={"vertical"}>
              <Typography.Text
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Summary
              </Typography.Text>
              <NoteHtmlDisplay value={item.summary} />
            </Space>
          )}
          <Space direction={"vertical"}>
            {item.summary ? (
              <Collapse
                ghost={true}
                expandIcon={({ isActive }) => (
                  <CaretRightOutlined rotate={isActive ? 90 : 0} />
                )}
                items={[
                  {
                    key: `col-${item.id}`,
                    label: "Note",
                    children: <NoteHtmlDisplay value={item.value} />,
                  },
                ]}
                style={{
                  width: "100%",
                }}
              />
            ) : (
              <NoteHtmlDisplay value={item.value} />
            )}
            {showAssociations && <NoteAssociations note={item} />}
          </Space>
        </Space>
        {showMetadata && (
          <Space
            style={{
              fontSize: "11px",
              backgroundColor: "#e6e6e6",
              alignItems: "center",
              fontFamily: "monospace",
            }}
            size={0}
          >
            <Space size={4} style={{ padding: 4, paddingRight: 16 }}>
              <ClockCircleOutlined />
              {createdTime.toFormat("hh:mm a")}
            </Space>
            <Space size={4} style={{ padding: 4 }}>
              <ClockCircleFilled />
              {modifiedTime.toFormat("MM-dd-yyyy hh:mm a")}
            </Space>
            <Space
              style={{
                width: 22,
                height: 22,
                background: `linear-gradient(45deg, #e6e6e6, #e6e6e6 50%, ${gradientRight} 50%, ${gradientRight})`,
              }}
            >
              &nbsp;
            </Space>
            {deletedTime && (
              <>
                <Space
                  size={4}
                  style={{
                    padding: 4,
                    backgroundColor: gradientRight,
                    color: "#ffffff",
                    height: 22,
                  }}
                >
                  <DeleteOutlined />
                  {deletedTime.toFormat("MM-dd-yyyy hh:mm a")}
                </Space>
                <Space
                  style={{
                    width: 22,
                    height: 22,
                    background: `linear-gradient(45deg, ${gradientRight}, ${gradientRight} 50%, #ffffff 50%, #ffffff)`,
                  }}
                >
                  &nbsp;
                </Space>
              </>
            )}
          </Space>
        )}
      </Space>
    );
  }

  return (
    <Space
      style={{
        width: "100%",
        paddingLeft: leftMargin,
        alignItems: "start",
      }}
      classNames={{ item: "timeline-content" }}
      direction={"horizontal"}
    >
      <Button
        onClick={toggleOpen}
        disabled={editing}
        style={{
          color: "#333",
          border: "none",
          boxShadow: "none",
          textAlign: "start",
          fontSize: "14px",
          fontWeight: 500,
          padding: 4,
        }}
        icon={
          entryOpen || editing ? <CaretDownOutlined /> : <CaretRightOutlined />
        }
      >
        {DateTime.fromISO(item.createdTime).toFormat("hh:mm a")}
      </Button>
      <Space direction={"horizontal"} style={{ whiteSpace: "nowrap" }}>
        <NotesTimelineEntryType
          entry={item}
          editing={editing}
          afterDelete={deleteCallback}
          afterRestore={restoreCallback}
          afterUpdateFlag={updateFlagCallback}
          editNoteCallback={() => {
            setEditing(true);
          }}
        />
        <Space style={{ width: 16, height: 4, borderTop: "2px solid #efefef" }}>
          &nbsp;
        </Space>
      </Space>
      <Space
        style={{
          border: "1px solid #e6e6e6",
          borderRadius: 4,
          width: "100%",
        }}
        styles={{
          item: { width: "100%" },
        }}
      >
        {noteContent}
      </Space>
    </Space>
  );
};
export default TimelineEntry;

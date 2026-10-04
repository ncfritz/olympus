import {
  CaretDownOutlined,
  CaretRightOutlined,
  ClockCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { Note } from "@ncfritz/olympus-sdk/minerva";
import { Button, Collapse, Space, Typography } from "antd";
import { DateTime } from "luxon";
import { type CSSProperties, useEffect, useState } from "react";
import * as React from "react";
import { useForm } from "react-hook-form";
import notesApi from "../../api/notestApi";
import { useFetch } from "../../hooks/useFetch";
import { config } from "../../utils/notes";
import LoadingWrapper from "../common/LoadingWrapper";
import NoteAssociations from "./NoteAssociations";
import NoteHtmlDisplay from "./NoteHtmlDisplay";
import NotesEditorForm, { type NotesFormInput } from "./NotesEditorForm";
import SubNoteEditor from "./SubNoteEditor";
import NotesTimelineEntryType from "./TimelineEntryTypeIcon";

export interface TimelineEntryProps {
  item: Note;
  showMetadata: boolean;
  showEditorTitle?: boolean;
  showEditorSummary?: boolean;
  showTime?: boolean;
  showAssociations?: boolean;
  deleteCallback: (entry: Note, isPermanent: boolean) => Promise<void>;
  restoreCallback: (entry: Note) => Promise<void>;
  updateCallback: (entry: Note) => Promise<void>;
  updateFlagCallback: (entry: Note) => Promise<void>;
  leftMargin?: number;
  rightMargin?: number;
  style?: CSSProperties;
  level?: number;
}

const TimelineEntry: React.FunctionComponent<TimelineEntryProps> = ({
  item,
  showMetadata,
  showEditorTitle = true,
  showEditorSummary = true,
  showAssociations = true,
  showTime = true,
  deleteCallback,
  restoreCallback,
  updateCallback,
  updateFlagCallback,
  leftMargin = 36,
  style,
  level = 0,
}: TimelineEntryProps) => {
  const [editing, setEditing] = useState(false);
  const [entryOpen, setEntryOpen] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [subEditorOpen, setSubEditorOpen] = useState(false);
  const [childrenVisible, setChildrenVisible] = useState(false);
  const [childrenFetched, setChildrenFetched] = useState(0);

  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: {
      type: item.type,
      flagged: item.flagged,
      title: item.title,
      summary: item.summary,
      value: item.value,
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const [
    children,
    childrenLoading,
    childrenError,
    fetchChildNotes,
    setChildren,
  ] = useFetch<string, Note[]>({
    params: item.id,
    dataType: "child notes",
    default: [],
    fetchFunction: async (o) => {
      return (await notesApi.getChildNotes(o)).data.notes;
    },
    noWatch: true,
  });

  useEffect(() => {
    if (childrenVisible && childrenFetched === 0) {
      (async () => {
        await fetchChildNotes(false);
        setChildrenFetched(new Date().getTime());
      })();
    }
  }, [childrenVisible]);

  const footerContent: { value: React.ReactNode; color: string }[] = [];
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

  const onChildCreated = async (created: Note) => {
    let newChildren: Note[];

    if (children) {
      newChildren = [created, ...children];
    } else {
      newChildren = [created];
    }

    setChildren(newChildren);
  };

  const onChildUpdate = async (updated: Note, isPermanent?: boolean) => {
    let newChildren: Note[];

    if (children) {
      newChildren = [...children]
        .filter((entry) => {
          if (updated.id === entry.id) {
            return !isPermanent;
          }

          return true;
        })
        .map((entry) => {
          return updated.id === entry.id ? updated : entry;
        });
    } else {
      newChildren = [updated];
    }

    setChildren(newChildren);
  };

  if (item.childCount > 0) {
    footerContent.push({
      color: "#e6e6e6",
      value: (
        <Space
          style={{
            width: "100%",
            height: 22,
            fontSize: "11px",
            backgroundColor: "#e6e6e6",
            alignItems: "center",
            lineHeight: "12px",
          }}
          size={0}
        >
          <Space
            size={4}
            style={{ padding: 4, paddingRight: 16, cursor: "pointer" }}
            onClick={() => {
              setChildrenVisible(!childrenVisible);
            }}
          >
            {childrenVisible ? <CaretDownOutlined /> : <CaretRightOutlined />}
            {item.childCount} {item.childCount > 1 ? "children" : "child"}
          </Space>
        </Space>
      ),
    });
  }

  if (deletedTime) {
    footerContent.push({
      color: "#912121",
      value: (
        <Space
          style={{
            width: "100%",
            height: 22,
            fontSize: "11px",
            backgroundColor: "#912121",
            alignItems: "center",
            lineHeight: "12px",
          }}
          size={0}
        >
          <Space
            size={4}
            style={{
              padding: 4,
              backgroundColor: "#912121",
              color: "#ffffff",
              height: 22,
            }}
          >
            <DeleteOutlined />
            {deletedTime.toFormat("MM-dd-yyyy hh:mm a")}
          </Space>
        </Space>
      ),
    });
  }

  if (showMetadata) {
    footerContent.push({
      color: "#f6f6f6",
      value: (
        <Space
          style={{
            width: "100%",
            height: 22,
            fontSize: "11px",
            backgroundColor: "#f6f6f6",
            alignItems: "center",
            fontFamily: "monospace",
            lineHeight: "12px",
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
        </Space>
      ),
    });
  }

  let noteContent;
  const noteStyle: CSSProperties = {
    padding: 8,
    width: "100%",
  };

  if (!entryOpen) {
    noteStyle.overflow = "hidden";
    noteStyle.height = 46;
  }

  if (editing) {
    noteContent = (
      <NotesEditorForm
        className={"contained"}
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
              lineHeight: "12px",
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
          size={0}
          style={noteStyle}
          className={entryOpen ? "" : "collapsed"}
        >
          {item.summary && (
            <Space orientation={"vertical"}>
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
          <Space
            direction={"vertical"}
            size={0}
            style={{
              width: "100%",
            }}
          >
            {item.summary ? (
              <Collapse
                ghost={true}
                expandIcon={({ isActive }) => (
                  <CaretRightOutlined rotate={isActive ? 90 : 0} />
                )}
                activeKey={noteOpen ? `col-${item.id}` : undefined}
                onChange={() => {
                  setNoteOpen(!noteOpen);
                }}
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
        <Space
          direction={"horizontal"}
          size={0}
          style={{
            width: "100%",
            justifyContent: showMetadata ? "space-between" : "end",
            alignItems: "end",
          }}
        >
          <Space
            direction={"horizontal"}
            style={{
              width: "100%",
              fontSize: "11px",
              alignItems: "center",
              lineHeight: "12px",
            }}
            size={0}
          >
            {footerContent.map((footerElement, index) => {
              let leftColor = "#ffffff";
              let rightColor = "#ffffff";

              if (index < footerContent.length - 1) {
                leftColor = footerElement.color;
                rightColor = footerContent[index + 1].color;
              } else if (index < footerContent.length) {
                leftColor = footerElement.color;
              }

              return (
                <>
                  {footerElement.value}
                  <Space
                    style={{
                      width: 22,
                      height: 22,
                      background: `linear-gradient(45deg, ${leftColor}, ${leftColor} 50%, ${rightColor} 50%, ${rightColor})`,
                    }}
                  >
                    &nbsp;
                  </Space>
                </>
              );
            })}
          </Space>
          {!subEditorOpen && (
            <Space orientation={"horizontal"} style={{ padding: 8 }}>
              <Button
                size={"small"}
                ghost={true}
                variant={"text"}
                color={"gold"}
                icon={<PlusOutlined />}
                onClick={() => {
                  setSubEditorOpen(true);
                }}
              >
                Add Child
              </Button>
            </Space>
          )}
        </Space>
      </Space>
    );
  }

  let mainMarginLeft = 135;

  if (level > 0) {
    mainMarginLeft = 34;
  }

  const classNames: string[] = ["timeline-content"];

  if (level > 1) {
    classNames.push("non-root");
  }

  if (!showTime) {
    classNames.push("no-time");
  }

  return (
    <div
      style={{
        ...style,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          width: `calc(100% - ${level > 0 ? 102 - level * 27 : 0}px)`,
          paddingLeft: leftMargin,
          alignItems: "start",
        }}
        className={classNames.join(" ")}
      >
        {showTime && (
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
              marginRight: 8,
            }}
            icon={
              entryOpen || editing ? (
                <CaretDownOutlined />
              ) : (
                <CaretRightOutlined />
              )
            }
          >
            {DateTime.fromISO(item.createdTime).toFormat("hh:mm a")}
          </Button>
        )}
        <Space
          direction={"horizontal"}
          style={{ whiteSpace: "nowrap" }}
          size={0}
        >
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
          <Space
            style={{ width: 16, height: 4, borderTop: "2px solid #efefef" }}
          >
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
      </div>
      {(subEditorOpen || childrenVisible) && (
        <Space
          direction={"vertical"}
          style={{
            width: `100%`,
            marginLeft: mainMarginLeft,
          }}
          size={0}
        >
          {subEditorOpen && (
            <SubNoteEditor
              parentId={item.id}
              level={level + 1}
              childrenPresent={childrenVisible && children.length > 0}
              onClose={() => {
                setSubEditorOpen(false);
              }}
              createCallback={onChildCreated}
              updateCallback={onChildUpdate}
            />
          )}
          {childrenVisible && (
            <LoadingWrapper
              loading={childrenLoading || !children}
              error={childrenError}
            >
              <Space
                direction={"vertical"}
                style={{ width: "100%" }}
                styles={{ item: { width: "100%" } }}
                size={0}
              >
                {children.map((child, index) => {
                  const style: CSSProperties = {
                    marginLeft: 66,
                    borderLeft: "1px solid #efefef",
                    paddingLeft: 8,
                  };

                  if (index === children.length - 1) {
                    style.borderImage =
                      "linear-gradient(to bottom, #efefef 16px, #ffffff 16px)";
                    style.borderImageSlice = 1;
                  }

                  return (
                    <div className={"tree-line"} style={style}>
                      <div
                        style={{
                          position: "relative",
                          left: -61,
                        }}
                      >
                        <TimelineEntry
                          key={`timeline-entry-${item.id}`}
                          item={child}
                          showMetadata={showMetadata}
                          showTime={false}
                          deleteCallback={onChildUpdate}
                          restoreCallback={onChildUpdate}
                          updateCallback={onChildUpdate}
                          updateFlagCallback={onChildUpdate}
                          style={{
                            paddingTop: 8,
                          }}
                          level={level + 1}
                        />
                      </div>
                    </div>
                  );
                })}
              </Space>
            </LoadingWrapper>
          )}
        </Space>
      )}
    </div>
  );
};
export default TimelineEntry;

import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import {
  CalendarOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { Collapse, Empty, Result, Space, Spin, Typography } from "antd";
import { DateTime } from "luxon";
import React, { type ReactNode, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import notesApi from "../../../api/notestApi";
import TimelineEntry from "../../notes/TimelineEntry";

export interface PreviousMeetingProps {
  event: Meeting;
  showMeta: boolean;
}

const PreviousMeeting: React.FunctionComponent<PreviousMeetingProps> = ({
  event,
  showMeta,
}: PreviousMeetingProps) => {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<any[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadNotes = async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
    }

    try {
      setError(false);

      const response = await notesApi.getNotesForEntity("meeting", event.id);
      setNotes(response.data.notes);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const afterNoteUpdate = async () => {
    await loadNotes(true);
  };

  useEffect(() => {
    if (notesOpen && !notes) {
      (async () => {
        await loadNotes();
      })();
    }
  }, [notesOpen]);

  const toggleNotesOpen = () => {
    setNotesOpen(!notesOpen);
  };

  const startTime = DateTime.fromISO(event.startTime);
  const endTime = DateTime.fromISO(event.endTime ?? "");

  let timelineContents: ReactNode | ReactNode[];

  if (loading) {
    timelineContents = (
      <Space
        direction={"vertical"}
        style={{ width: "100%", padding: 64, textAlign: "center" }}
      >
        <Spin size={"large"} />
      </Space>
    );
  } else if (error) {
    timelineContents = (
      <Result status={"error"} title={"Unable to load notes"} />
    );
  } else if (notes && notes.length > 0) {
    timelineContents = notes.map((item) => {
      return (
        <TimelineEntry
          key={uuidv4()}
          item={item}
          showMetadata={showMeta}
          showAssociations={false}
          deleteCallback={afterNoteUpdate}
          restoreCallback={afterNoteUpdate}
          updateCallback={afterNoteUpdate}
          updateFlagCallback={afterNoteUpdate}
          showEditorTitle={false}
          showEditorSummary={false}
          leftMargin={24}
        />
      );
    });
  } else {
    timelineContents = (
      <Empty
        key={uuidv4()}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={"No notes to display for this occurrence."}
      />
    );
  }

  return (
    <Collapse
      style={{ padding: 8 }}
      activeKey={notesOpen ? "notesTimeline" : undefined}
      expandIcon={(panelProps) => {
        return panelProps.isActive ? (
          <CaretDownOutlined />
        ) : (
          <CaretRightOutlined />
        );
      }}
      onChange={() => {
        toggleNotesOpen();
      }}
      ghost={true}
      items={[
        {
          key: "notesTimeline",
          label: (
            <Space
              direction={"horizontal"}
              className={`oa-event oa-status-${event.status.toLowerCase()} no-gutter`}
              size={8}
              style={{
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 4,
                padding: "2px 8px 2px 8px",
                marginBottom: notesOpen ? 8 : 0,
              }}
            >
              <Space orientation={"horizontal"} size={8}>
                <CalendarOutlined />
                <Typography.Text style={{ fontSize: "12px" }}>
                  {startTime.toFormat("DDDD")}
                </Typography.Text>
              </Space>
              <Space orientation={"horizontal"} size={8}>
                <ClockCircleOutlined />
                <Typography.Text style={{ fontSize: "12px" }}>
                  {startTime.toFormat("t")} - {endTime.toFormat("t")}
                </Typography.Text>
              </Space>
            </Space>
          ),
          children: (
            <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
              {timelineContents}
            </Space>
          ),
        },
      ]}
    />
  );
};
export default PreviousMeeting;

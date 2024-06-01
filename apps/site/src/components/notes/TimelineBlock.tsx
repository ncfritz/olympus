import {
  CalendarOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  EyeInvisibleOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { Button, Empty, Space, Spin, Tag } from "antd";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import * as React from "react";
import notesApi from "../../api/notestApi";
import { config, getIconForType, type Note } from "../../utils/notes";
import TimelineEntry from "./TimelineEntry";
import { v4 as uuidv4 } from "uuid";

interface NotesTimelineBlockProps {
  showDeleted: boolean;
  showFlaggedOnly: boolean;
  showMetadata: boolean;
  hideAssociated: boolean;
  typeFilters: Record<string, boolean>;
  date: string;
  openDates: Record<string, boolean>;
  summary: Record<number | string, number>;
  afterUpdate: (entry: Note, isPermanent?: boolean) => Promise<void>;
  renderEmptyDays?: boolean;
  summaryLoading: boolean;
  handleToggleDay: (date: Date) => void;
  toggleFilter: (noteType: string) => void;
}

const NotesTimelineBlock: React.FunctionComponent<NotesTimelineBlockProps> = ({
  showDeleted,
  showFlaggedOnly,
  showMetadata,
  hideAssociated,
  typeFilters,
  date,
  openDates,
  summary,
  afterUpdate,
  renderEmptyDays,
  summaryLoading,
  handleToggleDay,
  toggleFilter,
}: NotesTimelineBlockProps) => {
  const [entries, setEntries] = useState<Note[] | undefined>(undefined);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const blockDate = DateTime.fromISO(date, {
    zone: "America/Los_Angeles",
  }).startOf("day");

  useEffect(() => {
    (async () => {
      if (
        openDates[date] &&
        (!entries || summary["total"] !== entries.length)
      ) {
        setEntriesLoading(true);

        try {
          const fetchEntriesResponse = await notesApi.getNotes(
            blockDate.toUTC(),
          );
          setEntries(fetchEntriesResponse.data.notes);
        } catch (e) {
          console.log(e);
        } finally {
          setEntriesLoading(false);
        }
      }
    })();
  }, [openDates[date]]);

  const afterNoteUpdate = async (updated: Note, isPermanent?: boolean) => {
    let newEntries: Note[];

    if (entries) {
      newEntries = entries
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
      newEntries = [updated];
    }

    setEntries(newEntries);

    if (afterUpdate) {
      await afterUpdate(updated, isPermanent);
    }
  };
  const toggleDay = () => {
    handleToggleDay(DateTime.fromISO(date).toJSDate());
  };

  if (summary && summary["total"] <= 0 && !renderEmptyDays) {
    return null;
  }

  const itemsContent = [];

  if (openDates[date]) {
    if (summaryLoading || entriesLoading) {
      itemsContent.push(<Spin key={uuidv4()} size={"default"} />);
    } else if (entries && entries.length > 0) {
      entries.forEach((item) => {
        if (!showDeleted && item.deletedTime) {
          return;
        }

        if (showFlaggedOnly && !item.flagged) {
          return;
        }

        if (typeFilters[config[item.type].type]) {
          return;
        }

        if (hideAssociated && item.associations.length > 0) {
          return;
        }

        itemsContent.push(
          <TimelineEntry
            key={uuidv4()}
            item={item}
            showMetadata={showMetadata}
            deleteCallback={afterNoteUpdate}
            restoreCallback={afterNoteUpdate}
            updateCallback={afterNoteUpdate}
            updateFlagCallback={afterNoteUpdate}
          />,
        );
      });
    }

    if (itemsContent.length <= 0) {
      itemsContent.push(
        <Empty
          key={uuidv4()}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            "No entries to display for this day. You may need to adjust your filter settings."
          }
        />,
      );
    }
  }

  const total = summary["total"];

  return (
    <Space direction={"vertical"} style={{ width: "100%" }}>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
        }}
        direction={"horizontal"}
      >
        <Button
          onClick={toggleDay}
          style={{
            color: "#333",
            border: "none",
            width: 250,
            boxShadow: "none",
            textAlign: "start",
            fontSize: "16px",
            fontWeight: 500,
          }}
          icon={
            openDates[date] ? <CaretDownOutlined /> : <CaretRightOutlined />
          }
        >
          <CalendarOutlined />
          {date}
        </Button>
        <Space>
          {openDates[date] && (
            <Tag
              bordered={false}
              style={{ color: "#666666", padding: 4, textAlign: "end" }}
              icon={<FilterOutlined />}
            >
              {itemsContent.length} of {total} items
            </Tag>
          )}
          <Space direction={"horizontal"} size={8}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const filtered = typeFilters[config[i].type];

              let color = config[i].color;
              const backgroundColor = config[i].backgroundColor;

              if (filtered || total <= 0) {
                color = "#cccccc";
              }

              return (
                <Button
                  key={uuidv4()}
                  style={{
                    minWidth: 50,
                    fontSize: "13px",
                    color: color,
                    backgroundColor: backgroundColor,
                    border: "none",
                    boxShadow: "none",
                  }}
                  onClick={() => {
                    toggleFilter(config[i].type);
                  }}
                >
                  <Space size={8}>
                    {getIconForType(i)}
                    {summary[config[i].type] ? summary[config[i].type] : 0}
                    {filtered && <EyeInvisibleOutlined />}
                  </Space>
                </Button>
              );
            })}
          </Space>
        </Space>
      </Space>
      <Space size={16} direction={"vertical"} style={{ width: "100%" }}>
        {itemsContent}
      </Space>
    </Space>
  );
};
export default NotesTimelineBlock;

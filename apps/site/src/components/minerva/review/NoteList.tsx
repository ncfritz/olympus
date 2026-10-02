import type { Note } from "@ncfritz/olympus-sdk/minerva";
import { Empty, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import { config } from "../../../utils/notes";
import styles from "./Review.module.css";

const { Text } = Typography;

export interface NoteListProps {
  notes: Note[];
  limit?: number;
}

/** The first line of a note's title, or of what it says. */
const firstLine = (note: Note): string =>
  (note.title || note.summary || note.value)
    .replace(/<[^>]+>/g, " ")
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

/** A day's notes, oldest first: time, type and first line. */
const NoteList: React.FunctionComponent<NoteListProps> = ({ notes, limit }) => {
  if (notes.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={"No notes"} />
    );
  }
  const ordered = [...notes].sort((a, b) =>
    a.createdTime.localeCompare(b.createdTime),
  );
  const shown = limit ? ordered.slice(0, limit) : ordered;
  return (
    <div>
      {shown.map((note) => {
        const type = config[note.type] ?? config[0];
        return (
          <div key={note.id} className={styles.row}>
            <span className={styles.time}>
              {DateTime.fromISO(note.createdTime).toFormat("h:mm")}
            </span>
            <span
              className={styles.dot}
              style={{ background: type.color }}
              aria-hidden={true}
            />
            <Text className={`${styles.rowMain} ${styles.ellipsis}`}>
              {firstLine(note)}
            </Text>
            <span className={styles.meta}>{type.label}</span>
          </div>
        );
      })}
      {limit && notes.length > limit && (
        <div className={`${styles.row} ${styles.meta}`}>
          {notes.length - limit} more
        </div>
      )}
    </div>
  );
};

export default NoteList;

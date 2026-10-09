import { Empty, Typography } from "antd";
import React from "react";
import {
  formatMinutes,
  formatSpan,
  type MeetingSpan,
} from "../../../utils/reviews";
import styles from "./Review.module.css";

const { Text } = Typography;

export interface MeetingListProps {
  spans: MeetingSpan[];
  /** At most this many, then "n more". */
  limit?: number;
}

/** A day's meetings: subject, time and length. */
const MeetingList: React.FunctionComponent<MeetingListProps> = ({
  spans,
  limit,
}) => {
  if (spans.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={"No meetings"} />
    );
  }
  const shown = limit ? spans.slice(0, limit) : spans;
  return (
    <div>
      {shown.map(({ meeting, start, end }) => (
        <div key={meeting.id} className={styles.row}>
          <div className={styles.rowMain}>
            <Text className={styles.ellipsis}>{meeting.subject}</Text>
            <span className={styles.meta}>{formatSpan(start, end)}</span>
          </div>
          <span className={styles.meta}>
            {formatMinutes(end.diff(start, "minutes").minutes)}
          </span>
        </div>
      ))}
      {limit && spans.length > limit && (
        <div className={`${styles.row} ${styles.meta}`}>
          {spans.length - limit} more
        </div>
      )}
    </div>
  );
};

export default MeetingList;

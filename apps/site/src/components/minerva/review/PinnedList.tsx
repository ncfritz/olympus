import { PushpinFilled } from "@ant-design/icons";
import { Button, Empty, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";
import type { PinnedHighlight } from "./pinned";
import styles from "./Review.module.css";

const { Text } = Typography;

export interface PinnedListProps {
  highlights: PinnedHighlight[];
  disabled?: boolean;
  /** Whether each says where it came from; not needed when grouped by it. */
  showSource?: boolean;
  /** Unpins; left out where the list is only read. */
  onUnpin?: (highlight: PinnedHighlight) => Promise<void>;
}

/** What the week's review pinned: each answer or note, and where it came from. */
const PinnedList: React.FunctionComponent<PinnedListProps> = ({
  highlights,
  disabled = false,
  showSource = true,
  onUnpin,
}) => {
  if (highlights.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={"Nothing pinned"}
      />
    );
  }
  return (
    <div>
      {highlights.map((h) => (
        <div key={h.pin.id} className={styles.row}>
          <div className={styles.rowMain}>
            <Text className={styles.answer}>{h.text}</Text>
            <span className={styles.meta}>
              {h.day && DateTime.fromISO(h.day).toFormat("cccc")}
              {showSource && `${h.day ? " · " : ""}${h.source}`}
            </span>
          </div>
          {onUnpin && (
            <Button
              size={"small"}
              type={"text"}
              icon={<PushpinFilled />}
              disabled={disabled}
              aria-label={"Unpin"}
              title={"Unpin"}
              onClick={() => void onUnpin(h)}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default PinnedList;

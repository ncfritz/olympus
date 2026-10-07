import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import { Badge, Button, Flex, Tooltip, Typography } from "antd";
import { DateTime } from "luxon";
import React from "react";

const { Text } = Typography;

/** The two-line cells' sizes: a first line, and a grey second. */
const FIRST = { fontSize: 12 };
const SECOND = { fontSize: 11 };

export interface SenderCellProps {
  name?: string;
  address?: string;
  /** Bold, with the unread dot. */
  unread?: boolean;
}

/**
 * A sender as the mail tables show it: the display name, and the address
 * under it in grey; the address alone when there is no name.
 */
export const SenderCell: React.FunctionComponent<SenderCellProps> = ({
  name,
  address,
  unread = false,
}) => (
  <Flex vertical={true} style={{ minWidth: 0 }}>
    <Flex align={"center"} gap={6} style={{ minWidth: 0 }}>
      {unread && <Badge color={"#1677ff"} />}
      <Text
        ellipsis={{ tooltip: name ?? address }}
        style={{ ...FIRST, fontWeight: unread ? 600 : 400 }}
      >
        {name ?? address ?? "(no sender)"}
      </Text>
    </Flex>
    {name && address && (
      <Text type={"secondary"} ellipsis={{ tooltip: address }} style={SECOND}>
        {address}
      </Text>
    )}
  </Flex>
);

export interface SubjectCellProps {
  subject?: string;
  snippet?: string;
  unread?: boolean;
}

/** A subject, and the snippet under it in grey. */
export const SubjectCell: React.FunctionComponent<SubjectCellProps> = ({
  subject,
  snippet,
  unread = false,
}) => (
  <Flex vertical={true} style={{ minWidth: 0 }}>
    <Text ellipsis={true} style={{ fontWeight: unread ? 600 : 400 }}>
      {subject ?? "(no subject)"}
    </Text>
    {snippet && (
      <Text type={"secondary"} ellipsis={true} style={{ fontSize: 12 }}>
        {snippet}
      </Text>
    )}
  </Flex>
);

/** When a message arrived: the date, and the time under it in grey. */
export const ReceivedCell: React.FunctionComponent<{ time: string }> = ({
  time,
}) => {
  const when = DateTime.fromISO(time);
  return (
    <Tooltip title={when.toLocaleString(DateTime.DATETIME_FULL)}>
      <Flex vertical={true}>
        <Text style={FIRST}>{when.toLocaleString(DateTime.DATE_MED)}</Text>
        <Text type={"secondary"} style={SECOND}>
          {when.toLocaleString(DateTime.TIME_SIMPLE)}
        </Text>
      </Flex>
    </Tooltip>
  );
};

export interface CaretExpandIconProps<T> {
  expanded: boolean;
  record: T;
  onExpand: (record: T, e: React.MouseEvent<HTMLElement>) => void;
  /** Names the row for a screen reader: "Review <label>". */
  label: string;
}

/** The mail tables' expand control: a caret, right when closed, down open. */
export const CaretExpandIcon = <T,>({
  expanded,
  record,
  onExpand,
  label,
}: CaretExpandIconProps<T>) => (
  <Button
    type={"text"}
    size={"small"}
    icon={expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
    aria-label={`${expanded ? "Close" : "Review"} ${label}`}
    aria-expanded={expanded}
    onClick={(e) => onExpand(record, e)}
  />
);

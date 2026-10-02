import { CalendarOutlined } from "@ant-design/icons";
import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import { Button, Popover, Select, Space, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { DateTime } from "luxon";
import React, { useState } from "react";
import { formatBlock } from "../../../utils/reviews";

export interface PlacePickerProps {
  item: ReviewItem;
  /** The days it can go on. */
  days: DateTime[];
  disabled?: boolean;
  onPlace: (
    item: ReviewItem,
    place: { day: string; start: string; end: string } | null,
  ) => Promise<void>;
}

/** Where a priority sits in the week, as the design writes it. */
export const placeLabel = (item: ReviewItem): string | undefined => {
  const block = formatBlock(item.scheduledStart, item.scheduledEnd);
  if (!item.scheduledOn || !block) return undefined;
  return `${dayjs(item.scheduledOn).format("ddd")} ${block}`;
};

/**
 * Puts a priority on a day and a time without dragging: the grid's
 * alternative, and the way to change a placed one's times.
 */
const PlacePicker: React.FunctionComponent<PlacePickerProps> = ({
  item,
  days,
  disabled = false,
  onPlace,
}) => {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string>(
    item.scheduledOn ?? days[0]?.toISODate() ?? "",
  );
  const label = placeLabel(item);
  const at = (clock?: string) => (clock ? dayjs(clock, "HH:mm") : null);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={"click"}
      title={"Give it a day and a time"}
      content={
        <Space orientation={"vertical"}>
          <Select
            value={day}
            aria-label={"Day"}
            onChange={setDay}
            options={days.map((d) => ({
              value: d.toISODate()!,
              label: d.toFormat("cccc d"),
            }))}
          />
          <TimePicker.RangePicker
            format={"HH:mm"}
            minuteStep={15}
            needConfirm={false}
            value={[at(item.scheduledStart), at(item.scheduledEnd)]}
            onChange={(range) => {
              const [start, end] = (range ?? []) as (Dayjs | null)[];
              if (start && end) {
                void onPlace(item, {
                  day,
                  start: start.format("HH:mm"),
                  end: end.format("HH:mm"),
                }).then(() => setOpen(false));
              }
            }}
          />
          {label && (
            <Button
              size={"small"}
              onClick={() =>
                void onPlace(item, null).then(() => setOpen(false))
              }
            >
              Take it off the week
            </Button>
          )}
        </Space>
      }
    >
      <Button
        size={"small"}
        type={label ? "default" : "text"}
        icon={<CalendarOutlined />}
        disabled={disabled}
        aria-label={label ? `Placed ${label}; change` : "Place in the week"}
      >
        {label}
      </Button>
    </Popover>
  );
};

export default PlacePicker;

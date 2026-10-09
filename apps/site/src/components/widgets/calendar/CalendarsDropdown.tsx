import { DownOutlined } from "@ant-design/icons";
import type { Calendar } from "@ncfritz/olympus-sdk/minerva";
import { Button, Checkbox, Dropdown, type MenuProps } from "antd";
import React, { useEffect, useState } from "react";
import calendarsApi from "../../../api/calendarsApi";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { toggleSourceHidden } from "../../../redux/slices/meetingsSlice";
import { calendarColor } from "../../../utils/calendars";
import styles from "./CalendarWidget.module.css";

/**
 * Which calendars the widget shows, from its heading: a borderless button
 * opening a list of the calendars to tick. The choice is the meetings
 * pages' too (their Filters tab), so a calendar hidden here is hidden there.
 * The list stays open while calendars are ticked.
 */
const CalendarsDropdown: React.FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const hiddenSources = useAppSelector((state) => state.meetings.hiddenSources);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCalendars(await calendarsApi.listCalendars());
      } catch {
        setCalendars([]);
      }
    })();
  }, []);

  const shown = calendars.filter((c) => !hiddenSources.includes(c.source));
  const label =
    calendars.length === 0 || shown.length === calendars.length
      ? "All calendars"
      : shown.length === 0
        ? "No calendars"
        : `${shown.length} of ${calendars.length} calendars`;

  const items: MenuProps["items"] =
    calendars.length === 0
      ? [{ key: "none", label: "No calendars", disabled: true }]
      : calendars.map((calendar) => ({
          key: calendar.source,
          label: (
            <Checkbox
              checked={!hiddenSources.includes(calendar.source)}
              // The menu item's click toggles it; the box only shows it.
              className={styles.calendarItem}
              tabIndex={-1}
            >
              <span
                className={styles.swatch}
                // The calendar's own color, chosen on the Calendars page.
                // eslint-disable-next-line no-restricted-syntax
                style={{ backgroundColor: calendarColor(calendar) }}
              />
              {calendar.source}
            </Checkbox>
          ),
        }));

  return (
    <Dropdown
      trigger={["click"]}
      open={open}
      // Closed by a click outside or on the button, not by ticking one.
      onOpenChange={(next, info) => {
        if (info.source === "trigger") setOpen(next);
      }}
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.preventDefault();
          dispatch(toggleSourceHidden(key));
        },
      }}
    >
      <Button type={"text"} size={"small"} aria-label={"Calendars shown"}>
        {label} <DownOutlined />
      </Button>
    </Dropdown>
  );
};

export default CalendarsDropdown;

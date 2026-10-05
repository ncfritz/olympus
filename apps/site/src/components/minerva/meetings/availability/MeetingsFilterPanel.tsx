import type { Calendar } from "@ncfritz/olympus-sdk/minerva";
import { Checkbox, Flex, Typography } from "antd";
import React, { useEffect, useState } from "react";
import calendarsApi from "../../../../api/calendarsApi";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import {
  toggleSourceHidden,
  toggleStatusHidden,
} from "../../../../redux/slices/meetingsSlice";
import { calendarColor } from "../../../../utils/calendars";
import { OVERRIDE_FILTERS } from "../../../../utils/meetingAvailability";
import styles from "./Availability.module.css";

/**
 * Which meetings and overrides the meetings pages show: by calendar, and by
 * override status (or none). Kept across the pages and across visits.
 */
const MeetingsFilterPanel: React.FunctionComponent = () => {
  const dispatch = useAppDispatch();
  const { hiddenSources, hiddenStatuses } = useAppSelector(
    (state) => state.meetings,
  );
  const [calendars, setCalendars] = useState<Calendar[]>();

  useEffect(() => {
    (async () => {
      try {
        setCalendars(await calendarsApi.listCalendars());
      } catch {
        setCalendars([]);
      }
    })();
  }, []);

  return (
    <Flex vertical={true} gap={16} className={styles.filters}>
      <Flex vertical={true} gap={8}>
        <Typography.Title level={5}>Calendars</Typography.Title>
        {calendars?.length === 0 && (
          <Typography.Text type={"secondary"}>No calendars</Typography.Text>
        )}
        {calendars?.map((calendar) => (
          <Checkbox
            key={calendar.calendarId}
            checked={!hiddenSources.includes(calendar.source)}
            onChange={() => dispatch(toggleSourceHidden(calendar.source))}
          >
            <Flex gap={8} align={"center"}>
              <span
                className={styles.swatch}
                // The calendar's own color, chosen on the Calendars page.
                // eslint-disable-next-line no-restricted-syntax
                style={{ backgroundColor: calendarColor(calendar) }}
              />
              {calendar.source}
            </Flex>
          </Checkbox>
        ))}
      </Flex>
      <Flex vertical={true} gap={8}>
        <Typography.Title level={5}>Override status</Typography.Title>
        {OVERRIDE_FILTERS.map((filter) => (
          <Checkbox
            key={filter.key}
            checked={!hiddenStatuses.includes(filter.key)}
            onChange={() => dispatch(toggleStatusHidden(filter.key))}
          >
            <Flex gap={8} align={"center"}>
              {filter.key !== "default" && (
                <span
                  className={`${styles.pickerSwatch} oa-light-status-${filter.key}`}
                />
              )}
              {filter.label}
            </Flex>
          </Checkbox>
        ))}
      </Flex>
    </Flex>
  );
};

export default MeetingsFilterPanel;

import type { EventInput } from "@fullcalendar/core";
import axios from "axios";
import { DateTime } from "luxon";

const getMeetings = async (startDate: DateTime, days: number) => {
  try {
    const getMeetingsResponse = await axios.get(
      `/api/v1/meetings/${startDate.toISODate()}?days=${days}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getMeetingsResponse;
  } catch (e) {
    throw e;
  }
};

const getMeeting = async (id: string) => {
  try {
    const getMeetingRessponse = await axios.get(
      `/api/v1/meeting/${encodeURIComponent(id)}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getMeetingRessponse;
  } catch (e) {
    throw e;
  }
};

const getSummary = async (
  start: DateTime,
  days: number = 30,
  summaryDays: number = 30,
) => {
  try {
    const getSummaryResponse = await axios.get(
      `/api/v1/meetings/summary/${start.toISODate()}?days=${days}&summaryDays=${summaryDays}`,
      {
        headers: {
          "x-ncfritz-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getSummaryResponse;
  } catch (e) {
    throw e;
  }
};

const toEvent = (meeting: any): EventInput => {
  return {
    id: meeting.id,
    allDay: meeting.isAllDay,
    start: DateTime.fromISO(meeting.startTime).toJSDate(),
    end: DateTime.fromISO(meeting.endTime).toJSDate(),
    title: meeting.subject,
    editable: false,
    classNames: ["oa-event", `oa-status-${meeting.status.toLowerCase()}`],
  };
};

const meetingsApi = {
  getMeetings: getMeetings,
  getMeeting: getMeeting,
  getSummary: getSummary,
  toEvent: toEvent,
};
export default meetingsApi;

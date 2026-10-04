import type { EventInput } from "@fullcalendar/core";
import {
  client,
  describeCalendarItem,
  getMeetingsStatistics,
  getMeetingsSummary,
  getNextCalendarItemOccurrence,
  listCalendarItems,
  listPreviousCalendarItemOccurrences,
  type Meeting,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";

class MeetingsApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  private buildHeaders(existing?: Record<string, string>) {
    return {
      headers: {
        ...existing,
        "x-ncfritz-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  async getMeetings(startDate: DateTime, days: number) {
    return await listCalendarItems({
      path: {
        start: startDate.toISODate()!,
      },
      query: {
        days: days,
      },
      ...this.buildHeaders(),
    });
  }

  async getMeeting(id: string) {
    return await describeCalendarItem({
      path: {
        meetingId: encodeURIComponent(id),
      },
      ...this.buildHeaders(),
    });
  }

  async getNextMeetingInSeries(id: string) {
    return await getNextCalendarItemOccurrence({
      path: {
        meetingId: encodeURIComponent(id),
      },
      ...this.buildHeaders(),
    });
  }

  async getPreviousMeetingInSeries(id: string, limit = 5) {
    return await listPreviousCalendarItemOccurrences({
      path: {
        meetingId: encodeURIComponent(id),
      },
      query: {
        limit: limit,
      },
      ...this.buildHeaders(),
    });
  }

  async getSummary(start: DateTime, days: number = 30) {
    return await getMeetingsSummary({
      path: {
        start: start.toISODate()!,
      },
      query: {
        days: days,
      },
      ...this.buildHeaders(),
    });
  }

  async getStatistics(start: DateTime, days: number = 30) {
    return await getMeetingsStatistics({
      path: {
        start: start.toISODate()!,
      },
      query: {
        days: days,
      },
    });
  }

  toEvent(meeting: Meeting): EventInput {
    return {
      id: meeting.id,
      allDay: meeting.isAllDay,
      start: DateTime.fromISO(meeting.startTime).toJSDate(),
      end: meeting.endTime
        ? DateTime.fromISO(meeting.endTime).toJSDate()
        : undefined,
      title: meeting.subject,
      editable: false,
      classNames: ["oa-event", `oa-status-${meeting.status.toLowerCase()}`],
    };
  }
}

const meetingsApi = new MeetingsApi();
export default meetingsApi;

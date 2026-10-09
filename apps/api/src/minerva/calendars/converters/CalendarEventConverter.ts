import {
  MeetingImportance,
  MeetingOccurrenceType,
  MeetingSensitivity,
  MeetingStatus,
} from "@ncfritz/olympus-model";
import type {
  CalendarEventFreeBusyStatus,
  CalendarEventImportance,
  CalendarEventMessage,
  CalendarEventOccurrenceType,
  CalendarEventResponse,
  CalendarEventSensitivity,
  CalendarEventType,
} from "@ncfritz/olympus-messages";

/**
 * A minerva.meetings row as the consumer writes it: the message's fields in
 * the vocabulary the table and the site already use (Outlook's), owned by
 * the account's user.
 */
export type MeetingRow = {
  id: string;
  subject: string;
  sensitivity: MeetingSensitivity;
  importance: MeetingImportance;
  occurrence_type: MeetingOccurrenceType;
  type: string;
  reminder: boolean;
  response: string;
  start_time: string;
  end_time: string;
  duration: number;
  all_day: boolean;
  status: MeetingStatus;
  location: string | null;
  cancelled: boolean;
  organizer_email: string | null;
  deleted: boolean;
  uid: string;
  recurrence_id: string | null;
  source: string;
  /** When the agent took the snapshot; null from a message queued before it said. */
  snapshot_time: string | null;
  user_id: string;
  account_id: string;
};

const SENSITIVITY: Record<CalendarEventSensitivity, MeetingSensitivity> = {
  normal: MeetingSensitivity.Normal,
  personal: MeetingSensitivity.Personal,
  private: MeetingSensitivity.Private,
  confidential: MeetingSensitivity.Confidential,
};

const IMPORTANCE: Record<CalendarEventImportance, MeetingImportance> = {
  low: MeetingImportance.Low,
  normal: MeetingImportance.Normal,
  high: MeetingImportance.High,
};

const OCCURRENCE: Record<CalendarEventOccurrenceType, MeetingOccurrenceType> = {
  single: MeetingOccurrenceType.Single,
  occurrence: MeetingOccurrenceType.Occurrence,
  series_master: MeetingOccurrenceType.RecurringMaster,
};

const TYPE: Record<CalendarEventType, string> = {
  appointment: "Appointment",
  meeting: "Meeting",
  other: "Other",
};

const RESPONSE: Record<CalendarEventResponse, string> = {
  organizer: "Organizer",
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Tentative",
  needs_action: "NotResponded",
};

const STATUS: Record<CalendarEventFreeBusyStatus, MeetingStatus> = {
  free: MeetingStatus.Free,
  busy: MeetingStatus.Busy,
  tentative: MeetingStatus.Tentative,
  out_of_office: MeetingStatus.OOF,
  working_elsewhere: MeetingStatus.WorkingElsewhere,
};

/** The columns an event sets; its owner's come from its account. */
export type MeetingFields = Omit<MeetingRow, "user_id" | "account_id">;

/**
 * The meeting columns of a calendar event, or what is wrong with the message.
 * A message that fails here never will succeed, so it is dead-lettered
 * rather than retried. No I/O.
 */
export const toMeetingFields = (
  message: unknown,
): { fields: MeetingFields } | { problems: string[] } => {
  const problems: string[] = [];
  if (!message || typeof message !== "object") {
    return { problems: ["the message is not an object"] };
  }
  const m = message as Partial<Record<keyof CalendarEventMessage, unknown>>;

  const text = (key: keyof CalendarEventMessage): string => {
    const value = m[key];
    if (typeof value !== "string" || !value)
      problems.push(`${key} is required`);
    return typeof value === "string" ? value : "";
  };
  const optionalText = (key: keyof CalendarEventMessage): string | null => {
    const value = m[key];
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") problems.push(`${key} must be text`);
    return typeof value === "string" ? value : null;
  };
  const flag = (key: keyof CalendarEventMessage): boolean => {
    const value = m[key];
    if (typeof value !== "boolean")
      problems.push(`${key} must be true or false`);
    return value === true;
  };
  const time = (key: keyof CalendarEventMessage): string => {
    const value = m[key];
    const parsed = typeof value === "string" ? Date.parse(value) : NaN;
    if (Number.isNaN(parsed)) problems.push(`${key} must be an ISO-8601 time`);
    return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString();
  };
  const oneOf = <K extends string, V>(
    key: keyof CalendarEventMessage,
    values: Record<K, V>,
  ): V => {
    const value = m[key];
    if (typeof value !== "string" || !(value in values)) {
      problems.push(`${key} must be one of ${Object.keys(values).join(", ")}`);
      return undefined as V;
    }
    return values[value as K];
  };

  const duration = m.duration;
  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration < 0
  ) {
    problems.push("duration must be a number of minutes");
  }

  const fields: MeetingFields = {
    id: text("id"),
    // An event may have no title; the column allows it, the site shows it
    // as untitled.
    subject: typeof m.subject === "string" ? m.subject : "",
    sensitivity: oneOf("sensitivity", SENSITIVITY),
    importance: oneOf("importance", IMPORTANCE),
    occurrence_type: oneOf("occurrenceType", OCCURRENCE),
    type: oneOf("type", TYPE),
    reminder: flag("reminder"),
    response: oneOf("response", RESPONSE),
    start_time: time("startTime"),
    end_time: time("endTime"),
    duration: typeof duration === "number" ? duration : 0,
    all_day: flag("allDay"),
    status: oneOf("status", STATUS),
    location: optionalText("location"),
    cancelled: flag("cancelled"),
    organizer_email: optionalText("organizerEmail"),
    deleted: flag("deleted"),
    uid: text("uid"),
    recurrence_id: optionalText("recurrenceId"),
    source: text("source"),
    snapshot_time:
      m.snapshotTime === undefined || m.snapshotTime === null
        ? null
        : time("snapshotTime"),
  };
  return problems.length ? { problems } : { fields };
};

/** The account a message names, if it names one well formed. */
export const accountOf = (
  message: unknown,
): { provider: string; subject: string } | undefined => {
  const account = (message as { account?: unknown } | null)?.account;
  if (!account || typeof account !== "object") return undefined;
  const { provider, subject } = account as Record<string, unknown>;
  return typeof provider === "string" &&
    typeof subject === "string" &&
    provider &&
    subject
    ? { provider, subject }
    : undefined;
};

export const MEETING_USER = `alias
  email
  given_name
  surname
  type`;

export const BASE_MEETING_ATTENDEE = `attendance
  response
  user {
    ${MEETING_USER}
  }`;

export const MEETING_ATTENDEE = `
  ${BASE_MEETING_ATTENDEE}
  attendee_email`;

/** Meeting columns and organizer, without `source` or attendees. */
export const MEETING_CORE = `id
  uid
  recurrence_id
  all_day
  cancelled
  deleted
  duration
  end_time
  importance
  location
  occurrence_type
  organizer {
    ${MEETING_USER}
  }
  reminder
  response
  sensitivity
  start_time
  status
  subject
  type`;

export const BASE_MEETING = `
  ${MEETING_CORE}
  source
  attendees {
    ${BASE_MEETING_ATTENDEE}
  }`;

export const MEETING_WITH_ATTENDEE_EMAILS = `
  ${MEETING_CORE}
  source
  attendees {
    ${MEETING_ATTENDEE}
  }`;

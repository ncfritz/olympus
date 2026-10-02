export const REVIEW_ANSWER = `id
  promptId
  body
  createdTime
  lastUpdatedTime`;

export const REVIEW = `id
  kind
  periodStart
  step
  overall
  mood
  energy
  focus
  progress
  balance
  completedTime
  createdTime
  lastUpdatedTime
  answers(order_by: { createdTime: asc }) {
    ${REVIEW_ANSWER}
  }`;

export const REVIEW_PROMPT = `id
  kind
  section
  label
  placeholder
  position
  archivedTime
  createdTime
  lastUpdatedTime`;

export const REVIEW_ITEM = `id
  reviewId
  scope
  periodStart
  kind
  title
  position
  status
  doneTime
  carriedFromId
  carryCount
  scheduledOn
  scheduledStart
  scheduledEnd
  createdTime
  lastUpdatedTime`;

export const REVIEW_PIN = `id
  reviewId
  answerId
  noteId
  createdTime
  lastUpdatedTime`;

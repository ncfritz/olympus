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

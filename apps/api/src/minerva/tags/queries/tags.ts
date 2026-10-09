export const TAG = `id
  name
  color
  createdTime
  lastUpdatedTime
  goalTags_aggregate(where: { goal: { deletedTime: { _is_null: true } } }) {
    aggregate {
      count
    }
  }`;

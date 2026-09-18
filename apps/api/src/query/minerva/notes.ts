export const NOTE_ASSOCIATED_ITEM = `itemId
  itemType
  createdTime`;

export const NOTE_ASSOCIATE_ITEM_WITH_NOTE_ID = `
  ${NOTE_ASSOCIATED_ITEM}
  noteId`;

export const NOTE_ASSOCIATED_ITEMS = `associatedItems {
    ${NOTE_ASSOCIATED_ITEM}
  }`;

export const NOTE_ASSOCIATED_ITEMS_WITH_NOTE_ID = `associatedItems {
    ${NOTE_ASSOCIATE_ITEM_WITH_NOTE_ID}
  }`;

export const BASE_NOTE = `id
  parent_id
  author
  createdTime
  lastUpdatedTime
  deletedTime
  type
  flagged
  title
  summary
  value
  children_aggregate {
    aggregate {
      count
    }
  }`;

export const NOTE_WITH_ASSOCIATIONS = `
  ${BASE_NOTE}
  ${NOTE_ASSOCIATED_ITEMS}`;

export const NOTE_WITH_ASSOCIATIONS_WITH_NOTE_ID = `
  ${BASE_NOTE}
  ${NOTE_ASSOCIATED_ITEMS_WITH_NOTE_ID}`;

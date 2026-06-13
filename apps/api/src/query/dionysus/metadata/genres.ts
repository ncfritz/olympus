export const BASE_GRNRE = `id
  type
  name
  createdTime
  lastUpdatedTime`;

export const GENRE_ASSOCIATION = `lastUpdatedTime
  createdTime
  genre { 
    ${BASE_GRNRE} 
  }`;

export const GENRES = `genres {
    ${GENRE_ASSOCIATION}
  }`;

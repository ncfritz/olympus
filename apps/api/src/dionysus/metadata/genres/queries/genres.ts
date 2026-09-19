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

export const GENRE_COUNT_STATISTIC = `genres
  count`;

export const GENRE_STATISTIC = `genre
  count`;

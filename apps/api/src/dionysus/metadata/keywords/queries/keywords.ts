export const BASE_KEYWORD = `id
  value
  createdTime
  lastUpdatedTime`;

export const KEYWORD_ASSOCIATION = `createdTime
  lastUpdatedTime
  keyword { 
    ${BASE_KEYWORD} 
  }`;

export const KEYWORDS = `keywords {
    ${KEYWORD_ASSOCIATION}
  }`;

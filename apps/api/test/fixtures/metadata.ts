/**
 * Minimal Hasura rows for Dionysus metadata (TMDB) entities: identifying
 * fields plus every array relationship the converters walk, empty. Tests add
 * the fields they assert on through overrides.
 */
const times = {
  createdTime: "2026-09-01T00:00:00Z",
  lastUpdatedTime: "2026-09-18T00:00:00Z",
};
const agg = (count: number) => ({ aggregate: { count } });

type Row = Record<string, unknown>;

export const languageRow = (overrides: Row = {}): Row => ({
  id: "en",
  name: "English",
  nativeName: "English",
  ...times,
  ...overrides,
});

export const movieRow = (overrides: Row = {}): Row => ({
  id: 603,
  title: "The Matrix",
  originalTitle: "The Matrix",
  voteAverage: 8.2,
  voteCount: 25000,
  releaseDate: "1999-03-31",
  originalLanguage: languageRow(),
  alternativeTitles: [],
  externalIds: [],
  images: [],
  keywords: [],
  productionCountries: [],
  productionCompanies: [],
  releaseDates: [],
  spokenLanguages: [],
  videos: [],
  cast: [],
  crew: [],
  genres: [],
  ...times,
  ...overrides,
});

export const networkRow = (overrides: Row = {}): Row => ({
  id: 49,
  name: "HBO",
  alternativeNames: [],
  images: [],
  tvSeries_aggregate: agg(12),
  ...times,
  ...overrides,
});

export const productionCompanyRow = (overrides: Row = {}): Row => ({
  id: 1,
  name: "Lucasfilm",
  alternativeNames: [],
  logos: [],
  children: [],
  movies_aggregate: agg(20),
  tvSeries_aggregate: agg(3),
  ...times,
  ...overrides,
});

export const tvSeriesRow = (overrides: Row = {}): Row => ({
  id: 1399,
  name: "Game of Thrones",
  originalLanguage: languageRow(),
  genres: [],
  alternativeTitles: [],
  certifications: [],
  episodeRuntimes: [],
  externalIds: [],
  keywords: [],
  originCountries: [],
  languages: [],
  spokenLanguages: [],
  createdBy: [],
  images: [],
  networks: [],
  productionCompanies: [],
  productionCountries: [],
  seasons: [],
  videos: [],
  ...times,
  ...overrides,
});

export const tvSeasonRow = (overrides: Row = {}): Row => ({
  id: 3624,
  seriesId: 1399,
  seasonNumber: 1,
  name: "Season 1",
  series: tvSeriesRow(),
  episodes_aggregate: agg(10),
  externalIds: [],
  images: [],
  videos: [],
  episodes: [],
  ...times,
  ...overrides,
});

export const tvEpisodeRow = (overrides: Row = {}): Row => ({
  id: 63056,
  seriesId: 1399,
  seasonId: 3624,
  seasonNumber: 1,
  episodeNumber: 1,
  name: "Winter Is Coming",
  series: tvSeriesRow(),
  season: tvSeasonRow(),
  externalIds: [],
  images: [],
  videos: [],
  ...times,
  ...overrides,
});

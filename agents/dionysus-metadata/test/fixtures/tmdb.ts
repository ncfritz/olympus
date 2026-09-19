/**
 * TMDB responses, trimmed to the fields the mappers read (shapes from
 * https://developer.themoviedb.org/reference). Lists carry a duplicate
 * where the mappers dedupe.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const image = (file_path: string, iso_639_1: string | null = "en") => ({
  file_path,
  width: 1000,
  height: 1500,
  iso_639_1,
});

const video = {
  type: "Trailer",
  iso_3166_1: "US",
  iso_639_1: "en",
  name: "Official Trailer",
  id: "v1",
  key: "abc123",
  site: "YouTube",
  size: 1080,
  official: true,
  published_at: "2024-01-02T03:04:05.000Z",
};

const aggregateCredits = {
  cast: [
    {
      id: 17,
      order: 0,
      original_name: "Lead",
      total_episode_count: 10,
      roles: [{ credit_id: "r1", character: "Hero", episode_count: 10 }],
    },
  ],
  crew: [
    {
      id: 18,
      original_name: "Showrunner",
      department: "Writing",
      total_episode_count: 10,
      jobs: [{ credit_id: "j1", job: "Writer", episode_count: 10 }],
    },
  ],
};

export const movieDetails = (): any => ({
  id: 603,
  adult: false,
  backdrop_path: "/backdrop.jpg",
  budget: 63000000,
  homepage: "https://example.test/matrix",
  imdb_id: "tt0133093",
  original_language: "en",
  original_title: "The Matrix",
  overview: "A hacker learns the truth.",
  popularity: 80.5,
  poster_path: "/poster.jpg",
  release_date: "1999-03-31",
  revenue: 463517383,
  runtime: 136,
  status: "Released",
  tagline: "Welcome to the Real World.",
  title: "The Matrix",
  video: false,
  vote_average: 8.2,
  vote_count: 25000,
  alternative_titles: {
    titles: [
      { title: "Matrix", type: "", iso_3166_1: "DE" },
      { title: "Matrix", type: "", iso_3166_1: "DE" },
    ],
  },
  credits: {
    cast: [
      {
        id: 6384,
        cast_id: 34,
        credit_id: "c1",
        original_name: "Keanu Reeves",
        character: "Neo",
        order: 0,
      },
    ],
    crew: [
      {
        id: 9339,
        credit_id: "c2",
        original_name: "Lilly Wachowski",
        department: "Directing",
        job: "Director",
      },
    ],
  },
  external_ids: {
    imdb_id: "tt0133093",
    wikidata_id: "Q83495",
    facebook_id: null,
    twitter_id: "",
  },
  genres: [{ id: 28 }, { id: 878 }],
  images: {
    logos: [image("/logo.png")],
    backdrops: [image("/b1.jpg", null)],
    posters: [image("/p1.jpg"), image("/p1.jpg")],
  },
  keywords: { keywords: [{ id: 310 }] },
  production_companies: [{ id: 79 }],
  production_countries: [{ iso_3166_1: "US" }],
  release_dates: {
    results: [
      {
        iso_3166_1: "US",
        release_dates: [
          {
            type: 3,
            release_date: "1999-03-31T00:00:00.000Z",
            iso_639_1: "",
            certification: "R",
            note: "",
          },
        ],
      },
    ],
  },
  spoken_languages: [{ iso_639_1: "en" }],
  videos: { results: [video] },
});

export const recommendations = (): any => ({
  results: [{ id: 604 }, { id: 604 }, { id: 605 }],
});

export const tvSeriesDetails = (): any => ({
  id: 2316,
  adult: false,
  backdrop_path: "/b.jpg",
  first_air_date: "2005-03-24",
  homepage: "https://example.test/office",
  in_production: false,
  last_air_date: "2013-05-16",
  last_episode_to_air: { id: 9001 },
  next_episode_to_air: null,
  name: "The Office",
  number_of_episodes: 201,
  number_of_seasons: 9,
  original_language: "en",
  original_name: "The Office",
  overview: "A mockumentary.",
  popularity: 300,
  poster_path: "/p.jpg",
  status: "Ended",
  tagline: "",
  type: "Scripted",
  vote_average: 8.6,
  vote_count: 4000,
  aggregate_credits: aggregateCredits,
  alternative_titles: {
    results: [{ title: "Office", type: "", iso_3166_1: "US" }],
  },
  content_ratings: { results: [{ rating: "TV-14", iso_3166_1: "US" }] },
  created_by: [{ id: 1, credit_id: "cb1" }],
  episode_run_time: [22, 22],
  external_ids: { tvdb_id: 73244, imdb_id: "tt0386676" },
  genres: [{ id: 35 }],
  images: {
    logos: [image("/l.png")],
    backdrops: [image("/b.jpg")],
    posters: [image("/p.jpg")],
  },
  keywords: { results: [{ id: 1 }] },
  languages: ["en"],
  networks: [{ id: 6 }],
  origin_country: ["US"],
  production_companies: [{ id: 2 }],
  production_countries: [{ iso_3166_1: "US" }],
  spoken_languages: [{ iso_639_1: "en" }],
  videos: { results: [video] },
  seasons: [{ season_number: 0 }, { season_number: 1 }, { season_number: 2 }],
});

export const tvSeasonDetails = (): any => ({
  id: 3812,
  air_date: "2005-03-24",
  name: "Season 1",
  overview: "",
  poster_path: null,
  season_number: 1,
  vote_average: 7.9,
  aggregate_credits: aggregateCredits,
  external_ids: { tvdb_id: 16 },
  images: { posters: [image("/s1.jpg", null)] },
  videos: { results: [] },
  episodes: [
    { episode_number: 1, air_date: "2005-03-24" },
    { episode_number: 2, air_date: "2005-03-29" },
  ],
});

export const tvEpisodeDetails = (): any => ({
  id: 9001,
  air_date: "2005-03-24",
  name: "Pilot",
  overview: "",
  still_path: "",
  runtime: 23,
  season_number: 1,
  production_code: "",
  episode_number: 1,
  vote_count: 100,
  vote_average: 7.5,
  credits: {
    cast: [
      {
        id: 17,
        character: "Michael",
        credit_id: "e1",
        order: 0,
        original_name: "Steve",
      },
    ],
    crew: [
      {
        id: 18,
        credit_id: "e2",
        original_name: "Ken",
        department: "Directing",
        job: "Director",
      },
    ],
    guest_stars: [
      {
        id: 19,
        character: "Guest",
        credit_id: "e3",
        order: 1,
        original_name: "Someone",
      },
    ],
  },
  external_ids: { imdb_id: "tt0664521", tvdb_id: 110413 },
  images: { stills: [image("/still.jpg", null)] },
  videos: { results: [] },
});

export const personDetails = (): any => ({
  id: 6384,
  name: "Keanu Reeves",
  adult: false,
  biography: "",
  birthday: "1964-09-02",
  place_of_birth: "Beirut, Lebanon",
  deathday: null,
  gender: 2,
  homepage: null,
  imdb_id: "nm0000206",
  known_for_department: "Acting",
  profile_path: "/k.jpg",
  popularity: 50,
  also_known_as: ["Киану Ривз", "Киану Ривз"],
  images: { profiles: [image("/k.jpg")] },
  external_ids: { imdb_id: "nm0000206", instagram_id: null },
});

export const collectionDetails = (): any => ({
  id: 2344,
  name: "The Matrix Collection",
  overview: "",
  poster_path: "/c.jpg",
  backdrop_path: "/cb.jpg",
  parts: [{ id: 603 }, { id: 604 }, { id: 603 }],
});

export const collectionImages = (): any => ({
  posters: [image("/c.jpg"), image("/c.jpg"), image("/c2.jpg", null)],
  backdrops: [image("/cb.jpg")],
});

export const companyDetails = (): any => ({
  id: 79,
  name: "Village Roadshow Pictures",
  description: "",
  headquarters: "Burbank",
  homepage: "",
  logo_path: "/v.png",
  origin_country: "US",
  parent_company: { id: 1, name: "Parent", logo_path: null },
});

export const networkDetails = (): any => ({
  id: 6,
  name: "NBC",
  headquarters: "New York City",
  homepage: "https://www.nbc.com",
  logo_path: "/nbc.png",
  origin_country: "US",
});

export const alternativeNames = (): any => ({
  results: [
    { name: "NBC", type: "" },
    { name: "NBC", type: "" },
  ],
});

export const logos = (): any => ({
  logos: [
    { id: "l1", file_type: ".svg", file_path: "/l.svg", width: 1, height: 1 },
  ],
});

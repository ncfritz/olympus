import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aggregate } from "../../fixtures/dionysus";
import {
  languageRow,
  movieRow,
  networkRow,
  productionCompanyRow,
  tvEpisodeRow,
  tvSeasonRow,
  tvSeriesRow,
} from "../../fixtures/metadata";
import { base64Json } from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const M = "/v1/dionysus/metadata";
type Row = Record<string, unknown>;

/**
 * Every read operation: URL, GraphQL operation, a minimal Hasura response,
 * and the variables the operation must send (IDs parsed as numbers).
 */
const READS: [string, string, Row, Row | undefined][] = [
  [
    `${M}/collection/10`,
    "DescribeCollection",
    {
      dionysus_collections_by_pk: {
        id: 10,
        name: "Matrix Collection",
        images: [],
        parts: [],
      },
    },
    { id: 10 },
  ],
  [
    `${M}/movie/603`,
    "DescribeMovie",
    { dionysus_movies_by_pk: movieRow() },
    { id: 603 },
  ],
  [
    `${M}/network/49`,
    "DescribeNetwork",
    { dionysus_networks_by_pk: networkRow() },
    { id: 49 },
  ],
  [
    `${M}/person/6384`,
    "DescribePerson",
    { dionysus_people_by_pk: { id: 6384, name: "Keanu Reeves" } },
    { id: 6384 },
  ],
  [
    `${M}/productionCompany/1`,
    "DescribeProductionCompany",
    { dionysus_production_companies_by_pk: productionCompanyRow() },
    { id: 1 },
  ],
  [
    `${M}/tvSeries/1399`,
    "DescribeTvSeries",
    { dionysus_tv_series_by_pk: tvSeriesRow() },
    { id: 1399 },
  ],
  [
    `${M}/tvEpisodes/63056`,
    "GetTvEpisodeById",
    { dionysus_tv_episodes_by_pk: tvEpisodeRow() },
    { episodeId: 63056 },
  ],
  [
    `${M}/tvSeries/1399/seasons/1`,
    "DescribeTvSeason",
    { dionysus_tv_seasons: [tvSeasonRow()] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/seasons/1/episodes/1`,
    "DescribeTvEpisode",
    { dionysus_tv_episodes: [tvEpisodeRow()] },
    undefined,
  ],
  [
    `${M}/movies`,
    "ListMovies",
    { dionysus_movies: [{ id: 603 }], dionysus_movies_aggregate: aggregate(1) },
    undefined,
  ],
  [
    `${M}/tvSeries`,
    "ListTvSeries",
    {
      dionysus_tv_series: [{ id: 1399 }],
      dionysus_tv_series_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/people`,
    "ListPeople",
    { dionysus_people: [{ id: 1 }], dionysus_people_aggregate: aggregate(1) },
    undefined,
  ],
  [
    `${M}/networks`,
    "ListNetworks",
    {
      dionysus_networks: [networkRow()],
      dionysus_networks_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/productionCompanies`,
    "ListProductionCompanies",
    {
      dionysus_production_companies: [productionCompanyRow()],
      dionysus_production_companies_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/genres`,
    "ListGenres",
    {
      dionysus_genres: [{ id: 28, name: "Action" }],
      dionysus_genres_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/certifications`,
    "ListCertifications",
    {
      dionysus_certifications: [{ country: "US", certification: "R" }],
      dionysus_certifications_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/countries`,
    "ListCountries",
    {
      dionysus_countries: [{ id: "US", name: "United States" }],
      dionysus_countries_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/keywords`,
    "ListKeywords",
    {
      dionysus_keywords: [{ id: 1, value: "hacker" }],
      dionysus_keywords_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/languages`,
    "ListLanguages",
    {
      dionysus_languages: [languageRow()],
      dionysus_languages_aggregate: aggregate(1),
    },
    undefined,
  ],
  [
    `${M}/movie/603/cast`,
    "ListMovieCast",
    { dionysus_movie_cast: [{ person: { id: 1 } }] },
    { id: 603 },
  ],
  [
    `${M}/movie/603/crew`,
    "ListMovieCrew",
    { dionysus_movie_crew: [{ person: { id: 1 } }] },
    { id: 603 },
  ],
  [
    `${M}/movie/603/collections`,
    "ListMovieCollections",
    {
      dionysus_movies_by_pk: {
        collections: [{ collection: { id: 1, images: [], parts: [] } }],
      },
    },
    { id: 603 },
  ],
  [
    `${M}/movie/603/recommendations`,
    "ListMovieRecommendations",
    { dionysus_movies_by_pk: { recommendations: [{ movie: { id: 1 } }] } },
    { id: 603 },
  ],
  [
    `${M}/network/49/tvSeries`,
    "ListNetworkTvSeries",
    {
      dionysus_networks_by_pk: {
        tvSeries: [{ tvSeries: { id: 1 } }],
        tvSeries_aggregate: aggregate(1),
      },
    },
    { id: 49 },
  ],
  [
    `${M}/productionCompany/1/movies`,
    "ListProductionCompanyMovies",
    {
      dionysus_production_companies_by_pk: {
        movies: [{ movie: { id: 1 } }],
        movies_aggregate: aggregate(1),
      },
    },
    { id: 1 },
  ],
  [
    `${M}/productionCompany/1/tvSeries`,
    "ListProductionCompanyTvSeries",
    {
      dionysus_production_companies_by_pk: {
        tvSeries: [{ tvSeries: { id: 1 } }],
        tvSeries_aggregate: aggregate(1),
      },
    },
    { id: 1 },
  ],
  [
    `${M}/person/1/movie/cast`,
    "ListMovieCastRolesForPerson",
    { dionysus_movie_cast: [{ movie: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/person/1/movie/crew`,
    "ListMovieCrewJobsForPerson",
    { dionysus_movie_crew: [{ movie: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/cast`,
    "ListTvSeriesCast",
    { dionysus_tv_series_cast: [{ person: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/crew`,
    "ListTvSeriesCrew",
    { dionysus_tv_series_crew: [{ person: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/recommendations`,
    "ListTvSeriesRecommendations",
    {
      dionysus_tv_series_by_pk: { recommendations: [{ tvSeries: { id: 1 } }] },
    },
    { id: 1399 },
  ],
  [
    `${M}/tvSeries/1399/seasons/1/cast`,
    "ListTvSeasonCast",
    { dionysus_tv_season_cast: [{ person: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/seasons/1/crew`,
    "ListTvSeasonCrew",
    { dionysus_tv_season_crew: [{ person: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/seasons/1/episodes/1/cast`,
    "ListTvEpisodeCast",
    { dionysus_tv_episode_cast: [{ person: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/seasons/1/episodes/1/crew`,
    "ListTvEpisodeCrew",
    { dionysus_tv_episode_crew: [{ person: { id: 1 } }] },
    undefined,
  ],
  [
    `${M}/tvSeries/1399/seasons/1/episodes/1/guestStars`,
    "ListTvEpisodeGuestStars",
    { dionysus_tv_episode_guest_stars: [{ person: { id: 1 } }] },
    undefined,
  ],
];

describe("Dionysus metadata API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => {
    t.reset();
    t.graphql.on("LookupTvSeasonId", { dionysus_tv_seasons: [{ id: 3624 }] });
    t.graphql.on("LookupTvEpisodeId", {
      dionysus_tv_episodes: [{ id: 63056 }],
    });
  });

  describe("reads", () => {
    it.each(READS)("GET %s (%s)", async (url, operation, row, variables) => {
      t.graphql.on(operation, row);

      const res = await t.http().get(url);

      expect(res.status).toBe(200);
      expect(t.graphql.calls(operation)).toHaveLength(1);
      if (variables) {
        expect(t.graphql.calls(operation)[0].variables).toMatchObject(
          variables,
        );
      }
    });

    it.each([
      [
        `${M}/collection/1`,
        "DescribeCollection",
        { dionysus_collections_by_pk: null },
      ],
      [`${M}/movie/1`, "DescribeMovie", { dionysus_movies_by_pk: null }],
      [`${M}/network/1`, "DescribeNetwork", { dionysus_networks_by_pk: null }],
      [`${M}/person/1`, "DescribePerson", { dionysus_people_by_pk: null }],
      [
        `${M}/productionCompany/1`,
        "DescribeProductionCompany",
        { dionysus_production_companies_by_pk: null },
      ],
      [
        `${M}/tvSeries/1`,
        "DescribeTvSeries",
        { dionysus_tv_series_by_pk: null },
      ],
      [
        `${M}/tvEpisodes/1`,
        "GetTvEpisodeById",
        { dionysus_tv_episodes_by_pk: null },
      ],
      [
        `${M}/movie/1/collections`,
        "ListMovieCollections",
        { dionysus_movies_by_pk: null },
      ],
      [
        `${M}/movie/1/recommendations`,
        "ListMovieRecommendations",
        { dionysus_movies_by_pk: null },
      ],
      [
        `${M}/network/1/tvSeries`,
        "ListNetworkTvSeries",
        { dionysus_networks_by_pk: null },
      ],
      [
        `${M}/productionCompany/1/movies`,
        "ListProductionCompanyMovies",
        { dionysus_production_companies_by_pk: null },
      ],
      [
        `${M}/productionCompany/1/tvSeries`,
        "ListProductionCompanyTvSeries",
        { dionysus_production_companies_by_pk: null },
      ],
      [
        `${M}/tvSeries/1/recommendations`,
        "ListTvSeriesRecommendations",
        { dionysus_tv_series_by_pk: null },
      ],
    ])("GET %s answers 404 for an unknown ID", async (url, operation, row) => {
      t.graphql.on(operation, row);

      await t.http().get(url).expect(404);

      expect(t.graphql.calls(operation)).toHaveLength(1);
    });

    it("answers 404 for an unknown season", async () => {
      t.graphql.on("LookupTvSeasonId", { dionysus_tv_seasons: [] });

      await t.http().get(`${M}/tvSeries/1399/seasons/99/cast`).expect(404);
    });

    it.each([
      `${M}/movie/matrix`,
      `${M}/movie/60.3`,
      `${M}/person/x/movie/cast`,
      `${M}/tvSeries/1399/seasons/one`,
      `${M}/tvSeries/1399/seasons/1/episodes/1e3x`,
      `${M}/productionCompany/abc/movies`,
      `${M}/network/HBO`,
    ])("rejects the non-numeric ID in %s", async (url) => {
      await t.http().get(url).expect(400);

      expect(t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("paging and filters", () => {
    it.each([
      ["ListCountries", "countries", "dionysus_countries"],
      ["ListLanguages", "languages", "dionysus_languages"],
      ["ListKeywords", "keywords", "dionysus_keywords"],
    ])(
      "%s pages through buildPaginationExpression",
      async (operation, path, root) => {
        t.graphql.on(operation, {
          [root]: [],
          [`${root}_aggregate`]: aggregate(0),
        });

        await t
          .http()
          .get(`${M}/${path}?pageSize=5&startPage=2&sortBy=name&sort=asc`)
          .expect(200);

        expect(t.graphql.calls(operation)[0].document).toContain(
          "limit: 5, offset: 10, order_by: [{name: asc}]",
        );
      },
    );

    it.each([
      `${M}/countries?sortBy=name}) { id } x: y(`,
      `${M}/languages?pageSize=10) { id } x: y(limit: 1`,
      `${M}/keywords?sort=asc}]`,
      `${M}/networks?startPage=-1`,
      `${M}/productionCompanies?sortBy=a b`,
      `${M}/network/49/tvSeries?pageSize=abc`,
      `${M}/productionCompany/1/movies?sort=sideways`,
      `${M}/productionCompany/1/tvSeries?sortBy=name:`,
    ])("rejects %s", async (url) => {
      await t.http().get(url).expect(400);

      expect(t.graphql.request).not.toHaveBeenCalled();
    });

    it.each([
      ["networks", "ListNetworks", "dionysus_networks", networkRow()],
      [
        "productionCompanies",
        "ListProductionCompanies",
        "dionysus_production_companies",
        productionCompanyRow(),
      ],
    ])(
      "GET %s turns column filters into escaped _in clauses",
      async (path, operation, root, row) => {
        t.graphql.on(operation, {
          [root]: [row],
          [`${root}_aggregate`]: aggregate(1),
        });

        await t
          .http()
          .get(`${M}/${path}`)
          .query({
            filters: base64Json({ origin_country: ['US"]}}', "GB"], name: [] }),
          })
          .expect(200);

        const { document } = t.graphql.calls(operation)[0];
        expect(document).toContain(
          'where: {_and: [{origin_country: {_in: ["US\\"]}}", "GB"]}}]}',
        );
        expect(document).toContain(`${root}_aggregate(where:`);
      },
    );

    it.each([
      ["a key that is not a column name", base64Json({ "a: {_neq": ["x"] })],
      ["values that are not a list", base64Json({ name: "HBO" })],
      ["values that are objects", base64Json({ name: [{ _neq: "x" }] })],
      ["mixed value types", base64Json({ id: [1, "2"] })],
      ["a list instead of an object", base64Json(["name"])],
      ["something that is not JSON", "not-base64-json"],
    ])("rejects filters with %s", async (_, filters) => {
      await t.http().get(`${M}/networks`).query({ filters }).expect(400);
    });
  });

  describe("statistics", () => {
    it.each([
      [
        "movies",
        "GetMovieGenreCountStatistics",
        "dionysus_movie_genre_count_statistics",
      ],
      [
        "tvSeries",
        "GetTvSeriesGenreCountStatistics",
        "dionysus_tv_series_genre_count_statistics",
      ],
    ])(
      "genre counts for %s land in the right bucket",
      async (path, operation, root) => {
        t.graphql.on(operation, {
          [root]: [
            { genres: 1, count: 50 },
            { genres: 3, count: 7 },
            { genres: 19, count: 1 },
            { genres: 0, count: 99 },
          ],
        });

        const res = await t.http().get(`${M}/genres/stats/counts/${path}`);

        expect(res.status).toBe(200);
        const byGenres = Object.fromEntries(
          res.body.statistics.map((s: { genres: number; count: number }) => [
            s.genres,
            s.count,
          ]),
        );
        expect(res.body.statistics).toHaveLength(19);
        expect(byGenres).toMatchObject({ 1: 50, 2: 0, 3: 7, 19: 1 });
      },
    );

    it.each([
      [
        "genres/stats/movies",
        "GetMovieGenreStatistics",
        { dionysus_movie_genre_statistics: [{ genre: "Action", count: 3 }] },
      ],
      [
        "genres/stats/tvSeries",
        "GetTvSeriesGenreStatistics",
        { dionysus_tv_series_genre_statistics: [{ genre: "Drama", count: 3 }] },
      ],
      [
        "movies/stats/aggregate",
        "GetMovieAggregateStatistics",
        {
          dionysus_movies_aggregate: {
            aggregate: {
              count: 1,
              avg: { budget: 1, revenue: 2, runtime: 3 },
              max: { revenue: 4 },
            },
          },
        },
      ],
      [
        "movies/stats/locations",
        "GetMovieLocationStatistics",
        { dionysus_movie_location_statistics: [] },
      ],
      [
        "movies/stats/releaseStatus",
        "GetMovieReleaseStatusStatistics",
        { dionysus_movie_release_status_statistics: [] },
      ],
      [
        "movies/stats/releaseYear",
        "GetMovieReleaseYearStatistics",
        { dionysus_movie_release_date_statistics: [] },
      ],
      [
        "movies/stats/runtime",
        "GetMovieRuntimeStatistics",
        { dionysus_movie_runtime_statistics: [{ rt: 136, count: 2 }] },
      ],
      [
        "person/stats/birthday",
        "GetPeopleBirthdayStatistics",
        { dionysus_people_birthday_statistics: [{ year: 1964, count: 1 }] },
      ],
      [
        "person/stats/deathday",
        "GetPeopleDeathdayStatistics",
        { dionysus_people_deathday_statistics: [] },
      ],
      [
        "person/stats/department",
        "GetPeopleDepartmentStatistics",
        { dionysus_people_known_for: [] },
      ],
      [
        "tv/series/stats/aggregate",
        "GetTvSeriesAggregateStatistics",
        {
          dionysus_tv_series_aggregate: {
            aggregate: {
              count: 1,
              sum: { numberOfEpisodes: 73, numberOfSeasons: 8 },
              max: { numberOfEpisodes: 73, numberOfSeasons: 8 },
              avg: { numberOfEpisodes: 73, numberOfSeasons: 8 },
            },
          },
        },
      ],
      [
        "tv/series/stats/runtime",
        "GetTvSeriesEpisodeRuntimeStatistics",
        { dionysus_tv_series_episode_runtime_statistics: [] },
      ],
      [
        "tv/series/stats/firstAirYear",
        "GetTvSeriesFirstAirYearStatistics",
        { dionysus_tv_series_first_air_date_statistics: [] },
      ],
      [
        "tv/series/stats/locations",
        "GetTvSeriesLocationStatistics",
        { dionysus_tv_series_location_statistics: [] },
      ],
      [
        "tv/series/stats/seasons",
        "GetTvSeriesSeasonStatistics",
        { dionysus_tv_series_season_statistics: [] },
      ],
      [
        "tv/series/stats/releaseStatus",
        "GetTvSeriesStatusStatistics",
        { dionysus_tv_series_status_statistics: [] },
      ],
    ])("GET %s (%s)", async (path, operation, row) => {
      t.graphql.on(operation, row);

      await t.http().get(`${M}/${path}`).expect(200);
    });

    it("labels movie runtimes", async () => {
      t.graphql.on("GetMovieRuntimeStatistics", {
        dionysus_movie_runtime_statistics: [{ rt: 136, count: 2 }],
      });

      const res = await t.http().get(`${M}/movies/stats/runtime`);

      expect(res.body.statistics).toEqual([
        { runtime: 136, label: "2h 16m", count: 2 },
      ]);
    });
  });

  describe("upserts", () => {
    it("CreateMovie stores the vote count as the vote count", async () => {
      t.graphql.on("CreateMovie", { insert_dionysus_movies_one: { id: 603 } });

      const res = await t
        .http()
        .put(`${M}/movies`)
        .send({
          movie: {
            id: 603,
            title: "The Matrix",
            voteAverage: 8.2,
            voteCount: 25000,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 603 });
      expect(t.graphql.calls("CreateMovie")[0].variables).toMatchObject({
        id: 603,
        voteAverage: 8.2,
        voteCount: 25000,
      });
    });

    it("CreateTVSeries splits cast roles and crew jobs into their own rows", async () => {
      t.graphql.on("CreateTVSeries", {
        insert_dionysus_tv_series_one: { id: 1399 },
        insert_dionysus_tv_series_cast_roles: { affected_rows: 1 },
        insert_dionysus_tv_series_crew_jobs: { affected_rows: 1 },
      });

      const res = await t
        .http()
        .put(`${M}/tvSeries`)
        .send({
          tvSeries: {
            id: 1399,
            name: "Game of Thrones",
            cast: [
              {
                personId: 22970,
                roles: [{ creditId: "c1", character: "Ned", episodeCount: 9 }],
              },
            ],
            crew: [
              {
                personId: 9813,
                jobs: [{ creditId: "c2", job: "Creator", episodeCount: 73 }],
              },
            ],
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ seriesId: 1399 });
      const variables = t.graphql.calls("CreateTVSeries")[0].variables!;
      expect(variables.cast).toEqual([{ personId: 22970 }]);
      expect(variables.castRoles).toEqual([
        {
          personId: 22970,
          seriesId: 1399,
          creditId: "c1",
          character: "Ned",
          episodeCount: 9,
        },
      ]);
      expect(variables.crewJobs).toEqual([
        {
          personId: 9813,
          seriesId: 1399,
          creditId: "c2",
          job: "Creator",
          episodeCount: 73,
        },
      ]);
      expect(variables).toMatchObject({
        numberOfEpisodes: 0,
        numberOfSeasons: 0,
      });
    });

    it("CreateTVSeriesSeason keys roles by series and season", async () => {
      t.graphql.on("CreateTVSeriesSeason", {
        insert_dionysus_tv_seasons_one: {
          id: 3624,
          seasonNumber: 1,
          seriesId: 1399,
        },
        insert_dionysus_tv_season_cast_roles: { affected_rows: 1 },
        insert_dionysus_tv_season_crew_jobs: { affected_rows: 0 },
      });

      const res = await t
        .http()
        .put(`${M}/tvSeries/1399/seasons`)
        .send({
          season: {
            id: 3624,
            seasonNumber: 1,
            cast: [
              {
                personId: 1,
                roles: [{ creditId: "c", character: "Arya", episodeCount: 10 }],
              },
            ],
            crew: [],
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        seasonId: 3624,
        seasonNumber: 1,
        seriesId: 1399,
      });
      expect(
        t.graphql.calls("CreateTVSeriesSeason")[0].variables,
      ).toMatchObject({
        seriesId: 1399,
        castRoles: [
          { personId: 1, seriesId: 1399, seasonId: 3624, creditId: "c" },
        ],
      });
    });

    it("CreateTVSeriesEpisode takes series and season from the path", async () => {
      t.graphql.on("CreateTVSeriesEpisode", {
        insert_dionysus_tv_episodes_one: {
          id: 63056,
          episodeNumber: 1,
          seasonId: 3624,
          seasonNumber: 1,
          seriesId: 1399,
        },
      });

      const res = await t
        .http()
        .put(`${M}/tvSeries/1399/season/1/episodes`)
        .send({ episode: { id: 63056, seasonId: 3624, episodeNumber: 1 } });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ episodeId: 63056, seriesId: 1399 });
      expect(
        t.graphql.calls("CreateTVSeriesEpisode")[0].variables,
      ).toMatchObject({
        seriesId: 1399,
        seasonNumber: 1,
      });
    });

    it.each([
      [
        "certifications",
        "CreateCertification",
        {
          certification: {
            country: "US",
            certification: "R",
            type: "movie",
            meaning: "Restricted",
            order: 4,
          },
        },
        {
          insert_dionysus_certifications_one: {
            country: "US",
            certification: "R",
            type: "movie",
          },
        },
        { country: "US", certification: "R", order: 4 },
      ],
      [
        "countries",
        "CreateCountry",
        { country: { id: "US", name: "United States" } },
        { insert_dionysus_countries_one: { id: "US", name: "United States" } },
        { id: "US", name: "United States" },
      ],
      [
        "genres",
        "CreateGenre",
        { genre: { id: 28, name: "Action" } },
        { insert_dionysus_genres_one: { id: 28, name: "Action" } },
        { id: 28, name: "Action" },
      ],
      [
        "keywords",
        "CreateKeyword",
        { keyword: { id: 1, value: "hacker" } },
        { insert_dionysus_keywords_one: { id: 1, value: "hacker" } },
        { id: 1, value: "hacker" },
      ],
      [
        "languages",
        "CreateLanguage",
        { language: { id: "en", name: "English", nativeName: "English" } },
        { insert_dionysus_languages_one: languageRow() },
        { id: "en", nativeName: "English" },
      ],
      [
        "networks",
        "CreateNetwork",
        {
          network: {
            id: 49,
            name: "HBO",
            originCountry: "US",
            logoPath: "/hbo.png",
            alternativeNames: [{ name: "Home Box Office", type: "" }],
            images: [],
          },
        },
        { insert_dionysus_networks_one: networkRow() },
        { country_id: "US", logo: "/hbo.png" },
      ],
      [
        "productionCompanies",
        "CreateProductionCompany",
        {
          company: {
            id: 1,
            name: "Lucasfilm",
            originCountry: "US",
            logoPath: "/l.png",
            parentCompanyId: 2,
            alternativeNames: [],
            logos: [],
          },
        },
        { insert_dionysus_production_companies_one: productionCompanyRow() },
        { country_id: "US", parent_company: 2 },
      ],
      [
        "people",
        "CreatePerson",
        {
          person: {
            id: 6384,
            name: "Keanu Reeves",
            externalIds: [{ type: "imdb", externalId: "nm0000206" }],
            alsoKnownAs: [],
            images: [],
          },
        },
        { insert_dionysus_people_one: { id: 6384, name: "Keanu Reeves" } },
        { id: 6384 },
      ],
      [
        "collections",
        "CreateCollection",
        {
          collection: {
            id: 2344,
            name: "The Matrix Collection",
            images: [],
            parts: [],
          },
        },
        {
          insert_dionysus_collections_one: {
            id: 2344,
            name: "The Matrix Collection",
            images: [],
            parts: [],
          },
        },
        { id: 2344 },
      ],
    ])(
      "PUT %s (%s) upserts and returns 201",
      async (path, operation, body, row, variables) => {
        t.graphql.on(operation, row);

        const res = await t.http().put(`${M}/${path}`).send(body);

        expect(res.status).toBe(201);
        expect(t.graphql.calls(operation)[0].variables).toMatchObject(
          variables,
        );
      },
    );
  });
});

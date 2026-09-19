/**
 * Unit tests for the TMDB metadata converters: every field mapping, and the
 * rule that a related row missing from the database (no referential
 * integrity yet) leaves the field undefined or skips the entry rather than
 * failing the whole read.
 */
import { Gender } from "@ncfritz/olympus-model";
import { describe, expect, it } from "vitest";
import { toDomainObject as toCertification } from "./CertificationConverter";
import { toDomainObject as toCollection } from "./CollectionConverter";
import {
  toAlternativeNameDomainObject,
  toAlternativeTitleDomainObject,
  toExternalIdDomainObject,
  toIdentifiableImageDomainObject,
  toTypedImageDomainObject,
  toVideoDomainObject,
} from "./common";
import { toCountryAssociationDomainObject } from "./CountryConverter";
import { toGenreAssociationDomainObject } from "./GenreConverter";
import { toKeywordAssociationDomainObject } from "./KeywordConverter";
import { toLanguageAssociationDomainObject } from "./LanguageConverter";
import {
  toDomainObject as toMovie,
  toDomainObjectWithCredits as toMovieWithCredits,
  toMovieReleaseDateDomainObject,
  toSparseDomainObject as toSparseMovie,
} from "./MovieConverter";
import {
  toDomainObject as toNetwork,
  toDomainObjectWithContentCounts as toNetworkWithCounts,
} from "./NetworkConverter";
import {
  toDomainObject as toPerson,
  toPersonAssociationDomainObject,
} from "./PersonConverter";
import {
  toFullDomainObject as toFullCompany,
  toSparseDomainObjectWithContentCounts as toCompanyWithCounts,
} from "./ProductionCompanyConverter";
import { toDomainObject as toEpisode } from "./tvEpisodeConverter";
import { toDomainObject as toSeason } from "./tvSeasonConverter";
import {
  toDomainObject as toSeries,
  toTvSeriesCastMember,
  toTvSeriesCrewMember,
} from "./tvSeriesConverter";

// Rows are built loosely and passed through `row()`; the converters' input
// types are exercised by the endpoint tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test rows
const row = <T = any>(value: Record<string, unknown>): T => value as T;
const times = {
  createdTime: "2026-09-01T00:00:00Z",
  lastUpdatedTime: "2026-09-18T00:00:00Z",
};
const iso = (value: { toISOString(): string } | undefined) =>
  value?.toISOString();

const country = { id: "US", name: "United States", ...times };
const language = { id: "en", name: "English", nativeName: "English", ...times };
const genre = { id: 28, name: "Action", type: "movie", ...times };
const keyword = { id: 4565, value: "dystopia", ...times };
const person = {
  id: 6384,
  name: "Keanu Reeves",
  gender: 2,
  adult: false,
  birthday: "1964-09-02",
  ...times,
};

const movie = (overrides: Record<string, unknown> = {}) => ({
  id: 603,
  title: "The Matrix",
  originalTitle: "The Matrix",
  adult: false,
  budget: 63000000,
  revenue: 463517383,
  runtime: 136,
  voteAverage: 8.2,
  voteCount: 25000,
  releaseDate: "1999-03-31",
  status: "Released",
  originalLanguage: language,
  genres: [{ genre, ...times }],
  alternativeTitles: [{ country, title: "Matrix", type: "", ...times }],
  externalIds: [{ externalId: "tt0133093", type: "imdb", ...times }],
  images: [
    {
      filePath: "/p.jpg",
      width: 1000,
      height: 1500,
      type: "poster",
      language,
      ...times,
    },
  ],
  keywords: [{ keyword, ...times }],
  productionCountries: [{ country, ...times }],
  productionCompanies: [
    {
      productionCompany: { id: 79, name: "Village Roadshow", ...times },
      ...times,
    },
  ],
  releaseDates: [
    {
      country,
      language,
      certification: {
        country: "US",
        certification: "R",
        type: "movie",
        order: 4,
        meaning: "Restricted",
        ...times,
      },
      releaseDate: "1999-03-31",
      note: "",
      type: 3,
      ...times,
    },
  ],
  spokenLanguages: [{ language, ...times }],
  videos: [
    {
      id: "v1",
      key: "vKQi3bBA1y8",
      name: "Trailer",
      site: "YouTube",
      size: 1080,
      official: true,
      type: "Trailer",
      publishedDate: "2021-01-01T00:00:00Z",
      country,
      language,
      ...times,
    },
  ],
  ...times,
  ...overrides,
});

const series = (overrides: Record<string, unknown> = {}) => ({
  id: 1399,
  name: "Game of Thrones",
  originalName: "Game of Thrones",
  numberOfSeasons: 8,
  numberOfEpisodes: 73,
  firstAirDate: "2011-04-17",
  lastAirDate: "2019-05-19",
  inProduction: false,
  originalLanguage: language,
  genres: [{ genre, ...times }],
  alternativeTitles: [],
  certifications: [],
  episodeRuntimes: [{ runTime: 60, ...times }],
  externalIds: [],
  keywords: [{ keyword, ...times }],
  originCountries: [{ country, ...times }],
  languages: [{ language, ...times }],
  spokenLanguages: [
    { language: { ...language, id: "de", name: "German" }, ...times },
  ],
  createdBy: [{ creditId: "c1", person, ...times }],
  images: [],
  networks: [
    {
      network: {
        id: 49,
        name: "HBO",
        alternativeNames: [],
        images: [],
        ...times,
      },
      ...times,
    },
  ],
  productionCompanies: [],
  productionCountries: [],
  seasons: [
    {
      id: 3624,
      seasonNumber: 1,
      name: "Season 1",
      episodes_aggregate: { aggregate: { count: 10 } },
      ...times,
    },
  ],
  videos: [],
  ...times,
  ...overrides,
});

const season = (overrides: Record<string, unknown> = {}) => ({
  id: 3624,
  seasonNumber: 1,
  name: "Season 1",
  airDate: "2011-04-17",
  episodes_aggregate: { aggregate: { count: 10 } },
  series: series(),
  externalIds: [],
  images: [],
  videos: [],
  episodes: [
    {
      id: 63056,
      episodeNumber: 1,
      seasonNumber: 1,
      name: "Winter Is Coming",
      ...times,
    },
  ],
  ...times,
  ...overrides,
});

describe("common metadata converters", () => {
  it("maps external IDs, alternative names and identifiable images", () => {
    expect(
      toExternalIdDomainObject(
        row({ externalId: "tt1", type: "imdb", ...times }),
      ),
    ).toMatchObject({ externalId: "tt1", type: "imdb" });
    expect(
      toAlternativeNameDomainObject(
        row({ name: "HBO Max", type: "", ...times }),
      ),
    ).toMatchObject({ name: "HBO Max" });
    expect(
      toIdentifiableImageDomainObject(
        row({
          id: "i1",
          fileType: ".svg",
          filePath: "/l.svg",
          width: 10,
          height: 5,
          ...times,
        }),
      ),
    ).toMatchObject({
      id: "i1",
      fileType: ".svg",
      filePath: "/l.svg",
      width: 10,
      height: 5,
    });
  });

  it("maps a video, including its publish date", () => {
    const video = toVideoDomainObject(row(movie().videos[0]));
    expect(video).toMatchObject({
      id: "v1",
      key: "vKQi3bBA1y8",
      site: "YouTube",
      official: true,
      country: { id: "US" },
      language: { id: "en" },
    });
    expect(iso(video.publishedTime)).toBe("2021-01-01T00:00:00.000Z");
  });

  it("leaves a missing country or language undefined", () => {
    const video = toVideoDomainObject(
      row({ ...movie().videos[0], country: null, language: null }),
    );
    expect(video.country).toBeUndefined();
    expect(video.language).toBeUndefined();

    expect(
      toAlternativeTitleDomainObject(
        row({ title: "Matrix", country: null, ...times }),
      ).country,
    ).toBeUndefined();
    expect(
      toTypedImageDomainObject(
        row({ filePath: "/x.jpg", language: null, ...times }),
      ).language,
    ).toBeUndefined();
  });

  it("maps associations with their audit times", () => {
    const association = toGenreAssociationDomainObject(
      row({ genre, ...times }),
    );
    expect(association.genre).toMatchObject({ id: 28, name: "Action" });
    expect(iso(association.createdTime)).toBe("2026-09-01T00:00:00.000Z");
    expect(
      toKeywordAssociationDomainObject(row({ keyword, ...times })).keyword
        .value,
    ).toBe("dystopia");
    expect(
      toCountryAssociationDomainObject(row({ country, ...times })).country.id,
    ).toBe("US");
    expect(
      toLanguageAssociationDomainObject(row({ language, ...times })).language
        .nativeName,
    ).toBe("English");
    expect(
      toCertification(
        row({
          country: "US",
          certification: "R",
          order: 4,
          meaning: "Restricted",
          ...times,
        }),
      ),
    ).toMatchObject({ certification: "R", order: 4, meaning: "Restricted" });
  });
});

describe("MovieConverter", () => {
  it("maps a movie and all of its related rows", () => {
    const result = toMovie(row(movie()));

    expect(result).toMatchObject({
      id: 603,
      title: "The Matrix",
      budget: 63000000,
      voteCount: 25000,
      originalLanguage: { id: "en" },
      genres: [{ genre: { id: 28 } }],
      alternativeTitles: [{ title: "Matrix", country: { id: "US" } }],
      externalIds: [{ externalId: "tt0133093" }],
      images: [{ filePath: "/p.jpg", type: "poster" }],
      keywords: [{ keyword: { id: 4565 } }],
      productionCountries: [{ country: { id: "US" } }],
      productionCompanies: [{ productionCompany: { id: 79 } }],
      releaseDates: [{ type: 3, certification: { certification: "R" } }],
      spokenLanguages: [{ language: { id: "en" } }],
      videos: [{ key: "vKQi3bBA1y8" }],
    });
    expect(iso(result.releaseDate)).toBe("1999-03-31T00:00:00.000Z");
  });

  it("survives related rows that are missing from the database", () => {
    const result = toMovie(
      row(
        movie({
          originalLanguage: null,
          genres: [{ genre: null, ...times }],
          keywords: [{ keyword: null, ...times }],
          productionCountries: [{ country: null, ...times }],
          productionCompanies: [{ productionCompany: null, ...times }],
          spokenLanguages: [{ language: null, ...times }],
          releaseDates: [
            {
              country: null,
              language: null,
              certification: null,
              releaseDate: "1999-03-31",
              ...times,
            },
          ],
        }),
      ),
    );

    expect(result.originalLanguage).toBeUndefined();
    expect(result.genres).toEqual([]);
    expect(result.keywords).toEqual([]);
    expect(result.productionCountries).toEqual([]);
    expect(result.productionCompanies).toEqual([]);
    expect(result.spokenLanguages).toEqual([]);
    expect(result.releaseDates[0]).toMatchObject({
      country: undefined,
      language: undefined,
      certification: undefined,
    });
  });

  it("maps a sparse movie with its media state", () => {
    const result = toSparseMovie(
      row({
        ...movie(),
        releaseDate: null,
        favorite: { createdTime: "2026-09-10T00:00:00Z" },
      }),
    );
    expect(result.releaseDate).toBeUndefined();
    expect(result.favorite).toBeDefined();
    expect(result.searchConfiguration).toBeUndefined();
    expect(result.asset).toBeUndefined();
  });

  it("keeps credits whose person exists", () => {
    const result = toMovieWithCredits(
      row(
        movie({
          cast: [
            {
              castId: 1,
              character: "Neo",
              creditId: "a",
              order: 0,
              person,
              ...times,
            },
            {
              castId: 2,
              character: "Ghost",
              creditId: "b",
              order: 1,
              person: null,
              ...times,
            },
          ],
          crew: [
            {
              creditId: "c",
              job: "Director",
              department: "Directing",
              person,
              ...times,
            },
          ],
        }),
      ),
    );
    expect(result.cast).toHaveLength(1);
    expect(result.cast[0]).toMatchObject({
      character: "Neo",
      person: { id: 6384 },
    });
    expect(result.crew[0]).toMatchObject({ job: "Director" });
  });

  it("maps a release date", () => {
    const date = toMovieReleaseDateDomainObject(row(movie().releaseDates[0]));
    expect(date).toMatchObject({ type: 3, country: { id: "US" } });
    expect(iso(date.releaseDate)).toBe("1999-03-31T00:00:00.000Z");
  });
});

describe("tvSeriesConverter", () => {
  it("maps a series and its related rows", () => {
    const result = toSeries(row(series()));

    expect(result).toMatchObject({
      id: 1399,
      numberOfSeasons: 8,
      originalLanguage: { id: "en" },
      genres: [{ genre: { id: 28 } }],
      runtimes: [{ runTime: 60 }],
      keywords: [{ keyword: { id: 4565 } }],
      originCountries: [{ country: { id: "US" } }],
      createdBy: [{ creditId: "c1", person: { id: 6384 } }],
      networks: [{ network: { id: 49 } }],
      seasons: [{ id: 3624, episodeCount: 10 }],
    });
    expect(iso(result.firstAirDate)).toBe("2011-04-17T00:00:00.000Z");
  });

  it("keeps languages and spoken languages apart", () => {
    const result = toSeries(row(series()));

    expect(result.languages.map((l) => l.language.id)).toEqual(["en"]);
    expect(result.spokenLanguages.map((l) => l.language.id)).toEqual(["de"]);
  });

  it("survives related rows that are missing from the database", () => {
    const result = toSeries(
      row(
        series({
          originalLanguage: null,
          genres: [{ genre: null, ...times }],
          keywords: [{ keyword: null, ...times }],
          originCountries: [{ country: null, ...times }],
          languages: [{ language: null, ...times }],
          spokenLanguages: [{ language: null, ...times }],
          certifications: [{ certification: null, ...times }],
          createdBy: [{ creditId: "c1", person: null, ...times }],
          networks: [{ network: null, ...times }],
        }),
      ),
    );

    expect(result.originalLanguage).toBeUndefined();
    for (const list of [
      result.genres,
      result.keywords,
      result.originCountries,
      result.languages,
      result.spokenLanguages,
      result.certifications,
      result.createdBy,
      result.networks,
    ]) {
      expect(list).toEqual([]);
    }
  });

  it("maps cast and crew with their roles and jobs", () => {
    const cast = toTvSeriesCastMember(
      row({
        order: 0,
        originalName: "Sean Bean",
        totalEpisodeCount: 9,
        person,
        roles: [
          { character: "Ned Stark", creditId: "r1", episodeCount: 9, ...times },
        ],
        ...times,
      }),
    );
    expect(cast).toMatchObject({
      totalEpisodeCount: 9,
      roles: [{ character: "Ned Stark", episodeCount: 9 }],
    });

    const crew = toTvSeriesCrewMember(
      row({
        department: "Writing",
        originalName: "David Benioff",
        totalEpisodeCount: 73,
        person,
        jobs: [{ job: "Writer", creditId: "j1", episodeCount: 50, ...times }],
        ...times,
      }),
    );
    expect(crew).toMatchObject({
      department: "Writing",
      jobs: [{ job: "Writer" }],
    });
  });
});

describe("tvSeasonConverter and tvEpisodeConverter", () => {
  it("maps a season with its series and episodes", () => {
    const result = toSeason(row(season()));
    expect(result).toMatchObject({
      id: 3624,
      episodeCount: 10,
      series: { id: 1399 },
      episodes: [{ id: 63056, name: "Winter Is Coming" }],
    });
  });

  it("maps an episode with its series and season", () => {
    const result = toEpisode(
      row({
        id: 63056,
        episodeNumber: 1,
        seasonNumber: 1,
        name: "Winter Is Coming",
        runtime: 62,
        series: series(),
        season: season(),
        externalIds: [],
        images: [],
        videos: [],
        ...times,
      }),
    );
    expect(result).toMatchObject({
      id: 63056,
      runtime: 62,
      series: { id: 1399 },
      season: { id: 3624 },
    });
  });

  it("leaves a missing series or season undefined", () => {
    expect(toSeason(row(season({ series: null }))).series).toBeUndefined();

    const episode = toEpisode(
      row({
        id: 1,
        series: null,
        season: null,
        externalIds: [],
        images: [],
        videos: [],
        ...times,
      }),
    );
    expect(episode.series).toBeUndefined();
    expect(episode.season).toBeUndefined();
  });
});

describe("PersonConverter", () => {
  it.each([
    [1, Gender.FEMALE],
    [2, Gender.MALE],
    [3, Gender.NON_BINARY],
    [0, Gender.UNKNOWN],
    [7, Gender.UNKNOWN],
  ])("maps TMDB gender %s", (code, gender) => {
    expect(toPerson(row({ ...person, gender: code })).gender).toBe(gender);
  });

  it("maps a person with dates and related rows", () => {
    const result = toPerson(
      row({
        ...person,
        deathday: null,
        biography: "Canadian actor",
        alsoKnownAs: [{ name: "Киану Ривз", ...times }],
        externalIds: [{ externalId: "nm0000206", type: "imdb", ...times }],
        images: [
          {
            id: "i",
            fileType: ".jpg",
            filePath: "/k.jpg",
            width: 1,
            height: 1,
            ...times,
          },
        ],
      }),
    );
    expect(result).toMatchObject({
      biography: "Canadian actor",
      alsoKnownAs: [{ name: "Киану Ривз" }],
      externalIds: [{ externalId: "nm0000206" }],
      images: [{ filePath: "/k.jpg" }],
    });
    expect(iso(result.birthday)).toBe("1964-09-02T00:00:00.000Z");
    expect(result.deathday).toBeUndefined();
    expect(
      toPersonAssociationDomainObject(row({ person, ...times })).person.id,
    ).toBe(6384);
  });
});

describe("NetworkConverter and ProductionCompanyConverter", () => {
  it("maps a network with its country, names, images and series count", () => {
    const result = toNetworkWithCounts(
      row({
        id: 49,
        name: "HBO",
        logo: "/hbo.png",
        country,
        alternativeNames: [{ name: "Home Box Office", type: "", ...times }],
        images: [],
        tvSeries_aggregate: { aggregate: { count: 12 } },
        ...times,
      }),
    );
    expect(result).toMatchObject({
      logoPath: "/hbo.png",
      originCountry: { id: "US" },
      alternativeNames: [{ name: "Home Box Office" }],
      tvSeriesCount: 12,
    });
    expect(
      toNetwork(
        row({
          id: 49,
          country: null,
          alternativeNames: [],
          images: [],
          ...times,
        }),
      ).originCountry,
    ).toBeUndefined();
  });

  it("maps a production company with its parent, children and logos", () => {
    const child = {
      id: 2,
      name: "ILM",
      alternativeNames: [],
      movies_aggregate: { aggregate: { count: 5 } },
      tvSeries_aggregate: { aggregate: { count: 1 } },
      ...times,
    };
    const result = toFullCompany(
      row({
        id: 1,
        name: "Lucasfilm",
        logo: "/l.png",
        country: null,
        alternativeNames: [],
        parent: { id: 3, name: "Disney", alternativeNames: [], ...times },
        children: [child],
        logos: [
          {
            id: "l1",
            fileType: ".png",
            filePath: "/l.png",
            width: 1,
            height: 1,
            ...times,
          },
        ],
        ...times,
      }),
    );
    expect(result).toMatchObject({
      logoPath: "/l.png",
      parent: { id: 3 },
      children: [{ id: 2, moviesCount: 5, tvSeriesCount: 1 }],
      logos: [{ id: "l1" }],
    });
    expect(result.originCountry).toBeUndefined();
    expect(toCompanyWithCounts(row(child))).toMatchObject({ moviesCount: 5 });
  });
});

describe("CollectionConverter", () => {
  it("maps a collection and skips parts whose movie is missing", () => {
    const result = toCollection(
      row({
        id: 2344,
        name: "The Matrix Collection",
        images: [],
        parts: [
          { movie: movie(), ...times },
          { movie: null, ...times },
        ],
        ...times,
      }),
    );
    expect(result).toMatchObject({ id: 2344, parts: [{ movie: { id: 603 } }] });
    expect(result.parts).toHaveLength(1);
  });
});

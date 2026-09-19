import type { MetadataFetchJob } from "@ncfritz/olympus-sdk/dionysus";
import { describe, expect, it } from "vitest";
import { toCollection } from "../../../src/entities/mappers/collection";
import { toMovie } from "../../../src/entities/mappers/movie";
import { toPerson } from "../../../src/entities/mappers/person";
import { toProductionCompany } from "../../../src/entities/mappers/productionCompany";
import { toTvEpisode } from "../../../src/entities/mappers/tvEpisode";
import { toTvNetwork } from "../../../src/entities/mappers/tvNetwork";
import { toTvSeason } from "../../../src/entities/mappers/tvSeason";
import { toTvSeries } from "../../../src/entities/mappers/tvSeries";
import * as tmdb from "../../fixtures/tmdb";

/**
 * TMDB responses → API entities. The snapshots pin every field; the
 * assertions name the rules.
 */
describe("toMovie", () => {
  const movie = toMovie(tmdb.movieDetails(), tmdb.recommendations());

  it("maps the movie", () => {
    expect(movie).toMatchSnapshot();
  });

  it("dedupes lists", () => {
    expect(movie.recommendations).toEqual([
      { recommendationId: 604 },
      { recommendationId: 605 },
    ]);
    expect(movie.alternativeTitles).toHaveLength(1);
    expect(movie.images?.filter((i) => i.type === "poster")).toHaveLength(1);
  });

  it("keeps the external ids TMDB has a value for", () => {
    expect(movie.externalIds).toEqual([
      { type: "imdb", externalId: "tt0133093" },
      { type: "wikidata", externalId: "Q83495" },
    ]);
  });

  it("defaults image languages to en and dates to ISO", () => {
    expect(movie.images).toContainEqual(
      expect.objectContaining({ type: "backdrop", languageCode: "en" }),
    );
    expect(movie.releaseDate).toBe("1999-03-31T00:00:00.000Z");
  });
});

describe("toTvSeries", () => {
  const series = toTvSeries(tmdb.tvSeriesDetails(), tmdb.recommendations());

  it("maps the series", () => {
    expect(series).toMatchSnapshot();
  });

  it("keeps each role and job of aggregate credits", () => {
    expect(series.cast).toEqual([
      expect.objectContaining({
        personId: 17,
        roles: [{ creditId: "r1", character: "Hero", episodeCount: 10 }],
      }),
    ]);
    expect(series.runtimes).toEqual([{ runTime: 22 }]);
    expect(series.externalIds).toContainEqual({
      type: "tvdb",
      externalId: "73244",
    });
  });
});

describe("toTvSeason", () => {
  it("maps the season", () => {
    const season = toTvSeason(tmdb.tvSeasonDetails());
    expect(season).toMatchSnapshot();
    expect(season.posterPath).toBeUndefined();
    expect(season.voteAverage).toBe(7.9);
  });
});

describe("toTvEpisode", () => {
  it("maps the episode, in its season from the fetch job's context", () => {
    const episode = toTvEpisode(tmdb.tvEpisodeDetails(), {
      context: { seasonId: "3812" },
    } as unknown as MetadataFetchJob);
    expect(episode).toMatchSnapshot();
    expect(episode.seasonId).toBe(3812);
    expect(episode.stillPath).toBeUndefined();
    expect(episode.guestStars).toHaveLength(1);
  });
});

describe("toPerson", () => {
  it("maps the person", () => {
    const person = toPerson(tmdb.personDetails());
    expect(person).toMatchSnapshot();
    expect(person.alsoKnownAs).toEqual([{ name: "Киану Ривз" }]);
    expect(person.deathday).toBeUndefined();
    expect(person.externalIds).toEqual([
      { type: "imdb", externalId: "nm0000206" },
    ]);
  });
});

describe("toCollection", () => {
  it("maps the collection", () => {
    const collection = toCollection(
      tmdb.collectionDetails(),
      tmdb.collectionImages(),
    );
    expect(collection).toMatchSnapshot();
    expect(collection.parts).toEqual([{ movieId: 603 }, { movieId: 604 }]);
    expect(collection.images).toHaveLength(3);
  });
});

describe("toProductionCompany", () => {
  it("maps the company", () => {
    const company = toProductionCompany(
      tmdb.companyDetails(),
      tmdb.alternativeNames(),
      tmdb.logos(),
    );
    expect(company).toMatchSnapshot();
    expect(company.parentCompanyId).toBe(1);
    expect(company.alternativeNames).toEqual([{ name: "NBC", type: "" }]);
  });
});

describe("toTvNetwork", () => {
  it("maps the network (alternative names as TMDB lists them)", () => {
    const network = toTvNetwork(
      tmdb.networkDetails(),
      tmdb.alternativeNames(),
      tmdb.logos(),
    );
    expect(network).toMatchSnapshot();
    expect(network.alternativeNames).toHaveLength(2);
  });
});

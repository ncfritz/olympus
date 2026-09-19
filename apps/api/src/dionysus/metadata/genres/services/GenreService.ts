import {
  Genre,
  GenreCountStatistic,
  GenreStatistic,
  PartialGenre,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  BASE_GRNRE,
  GENRE_COUNT_STATISTIC,
  GENRE_STATISTIC,
} from "../queries/genres";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { toDomainObject } from "../converters/GenreConverter";
import { GraphQlGenre } from "../types/genre";

type GraphQlCreateGenreResponse = {
  insert_dionysus_genres_one: GraphQlGenre;
};

type GraphQlListGenresResponse = {
  dionysus_genres: GraphQlGenre[];
  dionysus_genres_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlGenreCountRow = {
  genres: number;
  count: number;
};

type GraphQlGenreRow = {
  genre: string;
  count: number;
};

type GraphQlGetMovieGenreCountsResponse = {
  dionysus_movie_genre_count_statistics: GraphQlGenreCountRow[];
};

type GraphQlGetTvSeriesGenreCountsResponse = {
  dionysus_tv_series_genre_count_statistics: GraphQlGenreCountRow[];
};

type GraphQlGetMovieGenreResponse = {
  dionysus_movie_genre_statistics: GraphQlGenreRow[];
};

type GraphQlGetTvSeriesGenreResponse = {
  dionysus_tv_series_genre_statistics: GraphQlGenreRow[];
};

/** A 19-entry histogram: entry i holds the count of titles with i + 1 genres. */
const toCountHistogram = (
  rows: GraphQlGenreCountRow[],
): GenreCountStatistic[] => {
  const countStatistics: GenreCountStatistic[] = Array.from(
    { length: 19 },
    (v, i) => {
      return {
        genres: i + 1,
        count: 0,
      };
    },
  );

  rows.forEach((result) => {
    // Entry i holds the count of titles with i + 1 genres.
    const index = result.genres - 1;
    if (index >= 0 && index < countStatistics.length) {
      countStatistics[index].count = result.count;
    }
  });

  return countStatistics;
};

const toGenreStatistics = (rows: GraphQlGenreRow[]): GenreStatistic[] =>
  rows.map((result) => ({
    genre: result.genre,
    count: result.count,
  }));

/** Movie and TV genres in Hasura, and genre statistics. */
@Injectable()
export class GenreService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a genre. */
  async create(genre: PartialGenre): Promise<Genre> {
    const insertRequest = gql`
      mutation CreateGenre($id: numeric!, $name: String!, $type: String!) {
        insert_dionysus_genres_one(
          object: { id: $id, name: $name, type: $type }
          on_conflict: { constraint: genres_pkey, update_columns: [name] }
        ) {
          ${BASE_GRNRE}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateGenreResponse>(
        insertRequest,
        {
          id: genre.id,
          name: genre.name,
          type: genre.type,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_genres_one);
  }

  /** A page of genres and the total count matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters?: string,
  ): Promise<{ genres: Genre[]; count: number }> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListGenres {
        dionysus_genres(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_GRNRE}
        }
        dionysus_genres_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListGenresResponse>(fetchRequest);

    return {
      genres: fetchResponse.dionysus_genres.map((result) =>
        toDomainObject(result),
      ),
      count: fetchResponse.dionysus_genres_aggregate.aggregate.count,
    };
  }

  /** Histogram of the number of genres per movie. */
  async getMovieGenreCountStatistics(): Promise<GenreCountStatistic[]> {
    const fetchRequest = gql`
      query GetMovieGenreCountStatistics {
        dionysus_movie_genre_count_statistics {
          ${GENRE_COUNT_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieGenreCountsResponse>(
        fetchRequest,
      );

    return toCountHistogram(
      fetchResponse.dionysus_movie_genre_count_statistics,
    );
  }

  /** Histogram of the number of genres per TV series. */
  async getTvSeriesGenreCountStatistics(): Promise<GenreCountStatistic[]> {
    const fetchRequest = gql`
      query GetTvSeriesGenreCountStatistics {
        dionysus_tv_series_genre_count_statistics {
          ${GENRE_COUNT_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesGenreCountsResponse>(
        fetchRequest,
      );

    return toCountHistogram(
      fetchResponse.dionysus_tv_series_genre_count_statistics,
    );
  }

  /** The number of movies in each genre. */
  async getMovieGenreStatistics(): Promise<GenreStatistic[]> {
    const fetchRequest = gql`
      query GetMovieGenreStatistics {
        dionysus_movie_genre_statistics {
          ${GENRE_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieGenreResponse>(
        fetchRequest,
      );

    return toGenreStatistics(fetchResponse.dionysus_movie_genre_statistics);
  }

  /** The number of TV series in each genre. */
  async getTvSeriesGenreStatistics(): Promise<GenreStatistic[]> {
    const fetchRequest = gql`
      query GetTvSeriesGenreStatistics {
        dionysus_tv_series_genre_statistics {
          ${GENRE_STATISTIC}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesGenreResponse>(
        fetchRequest,
      );

    return toGenreStatistics(fetchResponse.dionysus_tv_series_genre_statistics);
  }
}

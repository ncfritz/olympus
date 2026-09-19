import {
  BaseTVSeries,
  FullProductionCompany,
  PartialAlternativeName,
  PartialIdentifiableImage,
  PartialProductionCompany,
  SparseMovie,
  SparseProductionCompany,
  SparseProductionCompanyWithContentCounts,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
  parseInFilters,
} from "../../../../utils/filterUtil";
import { toSparseDomainObject } from "../../movies/converters/MovieConverter";
import { GraphQlSparseMovie } from "../../movies/types/movie";
import { toBaseDomainObject } from "../../tv/converters/tvSeriesConverter";
import { GraphQlBaseTvSeries } from "../../tv/types/tvSeries";
import {
  toFullDomainObject,
  toSparseDomainObject as toSparseProductionCompanyDomainObject,
  toSparseDomainObjectWithContentCounts,
} from "../converters/ProductionCompanyConverter";
import {
  GraphQlFullProductionCompany,
  GraphQlSparseProductionCompany,
  GraphQlSparseProductionCompanyWithContentCounts,
} from "../types/productionCompany";

type GraphQlCreateProductionCompanyResponse = {
  insert_dionysus_production_companies_one: GraphQlSparseProductionCompany;
};

type GraphQlGetProductionCompanyResponse = {
  dionysus_production_companies_by_pk: GraphQlFullProductionCompany;
};

type GraphQlListProductionCompaniesResponse = {
  dionysus_production_companies: GraphQlSparseProductionCompanyWithContentCounts[];
  dionysus_production_companies_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlListProductionCompanyMoviesResponse = {
  dionysus_production_companies_by_pk: {
    movies: {
      movie: GraphQlSparseMovie;
    }[];
    movies_aggregate: {
      aggregate: {
        count: number;
      };
    };
  };
};

type GraphQlListProductionCompanyTvSeriesResponse = {
  dionysus_production_companies_by_pk: {
    tvSeries: {
      tvSeries: GraphQlBaseTvSeries;
    }[];
    tvSeries_aggregate: {
      aggregate: {
        count: number;
      };
    };
  };
};

/** Production companies in Hasura. */
@Injectable()
export class ProductionCompanyService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a production company. */
  async create(
    company: PartialProductionCompany,
  ): Promise<SparseProductionCompany> {
    const insertRequest = gql`
      mutation CreateProductionCompany(
        $country_id: String
        $description: String!
        $headquarters: String!
        $homepage: String!
        $id: numeric!
        $logo: String
        $name: String!
        $parent_company: numeric
        $alternativeNames: [dionysus_production_company_alternative_names_insert_input!]!
        $logos: [dionysus_production_company_logos_insert_input!]!
      ) {
        insert_dionysus_production_companies_one(
          object: {
            parent_company: $parent_company
            name: $name
            logo: $logo
            id: $id
            homepage: $homepage
            headquarters: $headquarters
            description: $description
            country_id: $country_id
            alternativeNames: {
              on_conflict: {
                constraint: production_companies_alternative_names_pkey
                update_columns: [name, type]
              }
              data: $alternativeNames
            }
            logos: {
              on_conflict: {
                constraint: production_company_logos_pkey
                update_columns: [id, filePath, fileType, width, height]
              }
              data: $logos
            }
          }
          on_conflict: {
            constraint: production_companies_pkey
            update_columns: [
              name
              logo
              homepage
              headquarters
              description
              country_id
              parent_company
            ]
          }
        ) {
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          country {
            createdTime
            id
            lastUpdatedTime
            name
          }
          createdTime
          description
          headquarters
          homepage
          id
          lastUpdatedTime
          logo
          name
        }
      }
    `;

    const alternativeNames: PartialAlternativeName[] = [];

    company.alternativeNames.forEach((value) => {
      alternativeNames.push({
        name: value.name,
        type: value.type,
      });
    });

    const logos: PartialIdentifiableImage[] = [];

    company.logos.forEach((value) => {
      logos.push({
        id: value.id,
        fileType: value.fileType,
        filePath: value.filePath,
        width: value.width,
        height: value.height,
      });
    });

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateProductionCompanyResponse>(
        insertRequest,
        {
          id: company.id,
          name: company.name,
          logo: company.logoPath,
          description: company.description,
          homepage: company.homepage,
          headquarters: company.headquarters,
          country_id: company.originCountry,
          parent_company: company.parentCompanyId,
          alternativeNames: alternativeNames,
          logos: logos,
        },
      );

    return toSparseProductionCompanyDomainObject(
      insertResponse.insert_dionysus_production_companies_one,
    );
  }

  /** @throws NotFoundException */
  async describe(productionCompanyId: number): Promise<FullProductionCompany> {
    const fetchRequest = gql`
      query DescribeProductionCompany($id: numeric!) {
        dionysus_production_companies_by_pk(id: $id) {
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          country {
            id
            createdTime
            lastUpdatedTime
            name
          }
          createdTime
          description
          headquarters
          homepage
          id
          lastUpdatedTime
          logo
          name
          logos {
            createdTime
            filePath
            fileType
            height
            id
            lastUpdatedTime
            width
          }
          children {
            alternativeNames {
              createdTime
              lastUpdatedTime
              name
              type
            }
            country {
              id
              createdTime
              lastUpdatedTime
              name
            }
            createdTime
            description
            headquarters
            homepage
            id
            lastUpdatedTime
            logo
            name
            movies_aggregate {
              aggregate {
                count
              }
            }
            tvSeries_aggregate {
              aggregate {
                count
              }
            }
          }
          parent {
            alternativeNames {
              createdTime
              lastUpdatedTime
              name
              type
            }
            country {
              createdTime
              lastUpdatedTime
              name
            }
            createdTime
            description
            headquarters
            homepage
            id
            lastUpdatedTime
            logo
            name
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetProductionCompanyResponse>(
        fetchRequest,
        {
          id: productionCompanyId,
        },
      );

    if (!fetchResponse.dionysus_production_companies_by_pk) {
      throw new NotFoundException();
    }

    return toFullDomainObject(
      fetchResponse.dionysus_production_companies_by_pk,
    );
  }

  /** A page of production companies and the total count matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters: string | undefined,
  ): Promise<{
    companies: SparseProductionCompanyWithContentCounts[];
    count: number;
  }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const queryParams = [paginationExpression];
    const where = buildFilterExpression(parseInFilters(filters));

    if (where) {
      queryParams.push(where);
    }

    const fetchRequest = gql`
      query ListProductionCompanies {
        dionysus_production_companies(${queryParams.join(", ")}) {
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          country {
            createdTime
            id
            lastUpdatedTime
            name
          }
          createdTime
          description
          headquarters
          homepage
          id
          lastUpdatedTime
          logo
          name
          movies_aggregate {
            aggregate {
              count
            }
          }
          tvSeries_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_production_companies_aggregate${where ? `(${where})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListProductionCompaniesResponse>(
        fetchRequest,
      );

    return {
      companies: fetchResponse.dionysus_production_companies.map((result) =>
        toSparseDomainObjectWithContentCounts(result),
      ),
      count:
        fetchResponse.dionysus_production_companies_aggregate.aggregate.count,
    };
  }

  /** A page of a production company's movies and their total count. @throws NotFoundException */
  async listMovies(
    productionCompanyId: number,
    pagination: PaginationParams,
  ): Promise<{ movies: SparseMovie[]; count: number }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const queryParams = [paginationExpression];

    const fetchRequest = gql`
      query ListProductionCompanyMovies($id: numeric!) {
        dionysus_production_companies_by_pk(id: $id) {
          movies(${queryParams.join(", ")}) {
            movie {
              adult
              backdropPath
              budget
              createdTime
              homepage
              id
              imdbId
              lastUpdatedTime
              originalLanguageCode
              originalTitle
              overview
              popularity
              posterPath
              releaseDate
              revenue
              runtime
              status
              tagline
              title
              voteAverage
              voteCount
              video
            }
          }
          movies_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListProductionCompanyMoviesResponse>(
        fetchRequest,
        {
          id: productionCompanyId,
        },
      );
    if (!fetchResponse.dionysus_production_companies_by_pk) {
      throw new NotFoundException();
    }

    const movies: SparseMovie[] = [];

    fetchResponse.dionysus_production_companies_by_pk.movies.forEach(
      (result) => {
        // Skip links to rows that are not in the database (yet).
        if (result.movie) {
          movies.push(toSparseDomainObject(result.movie));
        }
      },
    );

    return {
      movies: movies,
      count:
        fetchResponse.dionysus_production_companies_by_pk.movies_aggregate
          .aggregate.count,
    };
  }

  /** A page of a production company's TV series and their total count. @throws NotFoundException */
  async listTvSeries(
    productionCompanyId: number,
    pagination: PaginationParams,
  ): Promise<{ tvSeries: BaseTVSeries[]; count: number }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const queryParams = [paginationExpression];

    const fetchRequest = gql`
      query ListProductionCompanyTvSeries($id: numeric!) {
        dionysus_production_companies_by_pk(id: $id) {
          tvSeries(${queryParams.join(", ")}) {
            tvSeries {
              adult
              backdropPath
              createdTime
              firstAirDate
              homepage
              id
              inProduction
              lastAirDate
              lastEpisodeToAirId
              lastUpdatedTime
              name
              numberOfEpisodes
              numberOfSeasons
              originalName
              original_language
              overview
              popularity
              posterPath
              status
              tagline
              type
              voteAverage
              voteCount
            }
          }
          tvSeries_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListProductionCompanyTvSeriesResponse>(
        fetchRequest,
        {
          id: productionCompanyId,
        },
      );
    if (!fetchResponse.dionysus_production_companies_by_pk) {
      throw new NotFoundException();
    }

    const tvSeries: BaseTVSeries[] = [];

    fetchResponse.dionysus_production_companies_by_pk.tvSeries.forEach(
      (result) => {
        // Skip links to rows that are not in the database (yet).
        if (result.tvSeries) {
          tvSeries.push(toBaseDomainObject(result.tvSeries));
        }
      },
    );

    return {
      tvSeries: tvSeries,
      count:
        fetchResponse.dionysus_production_companies_by_pk.tvSeries_aggregate
          .aggregate.count,
    };
  }
}

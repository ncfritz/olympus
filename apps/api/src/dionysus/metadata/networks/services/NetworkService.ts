import {
  BaseTVSeries,
  Network,
  NetworkWithContentCounts,
  PartialAlternativeName,
  PartialIdentifiableImage,
  PartialNetwork,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
  parseInFilters,
} from "../../../../utils/filterUtil";
import { toBaseDomainObject } from "../../tv/converters/tvSeriesConverter";
import { GraphQlBaseTvSeries } from "../../tv/types/tvSeries";
import {
  toDomainObject,
  toDomainObjectWithContentCounts,
} from "../converters/NetworkConverter";
import {
  GraphQlNetwork,
  GraphQlNetworkWithContentCounts,
} from "../types/tvNetworks";

type GraphQlCreateNetworkResponse = {
  insert_dionysus_networks_one: GraphQlNetwork;
};

type GraphQlGetNetworkResponse = {
  dionysus_networks_by_pk: GraphQlNetworkWithContentCounts;
};

type GraphQlListNetworksResponse = {
  dionysus_networks: GraphQlNetworkWithContentCounts[];
  dionysus_networks_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlListNetworkTvSeriesResponse = {
  dionysus_networks_by_pk: {
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

/** TV networks in Hasura. */
@Injectable()
export class NetworkService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a network. */
  async create(network: PartialNetwork): Promise<Network> {
    const insertRequest = gql`
      mutation CreateNetwork(
        $country_id: String!
        $headquarters: String!
        $homepage: String!
        $id: numeric!
        $logo: String
        $name: String!
        $alternativeNames: [dionysus_network_alternative_names_insert_input!]!
        $images: [dionysus_network_images_insert_input!]!
      ) {
        insert_dionysus_networks_one(
          object: {
            name: $name
            logo: $logo
            id: $id
            homepage: $homepage
            headquarters: $headquarters
            country_id: $country_id
            alternativeNames: {
              on_conflict: {
                constraint: network_alternative_name_pkey
                update_columns: [name, type]
              }
              data: $alternativeNames
            }
            images: {
              on_conflict: {
                constraint: network_images_pkey
                update_columns: [id, filePath, fileType, width, height]
              }
              data: $images
            }
          }
          on_conflict: {
            constraint: networks_pkey
            update_columns: [name, logo, homepage, headquarters, country_id]
          }
        ) {
          country {
            createdTime
            lastUpdatedTime
            name
            id
          }
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          createdTime
          headquarters
          homepage
          id
          logo
          name
          lastUpdatedTime
          images {
            createdTime
            filePath
            fileType
            height
            id
            lastUpdatedTime
            width
          }
        }
      }
    `;

    const alternativeNames: Omit<PartialAlternativeName, "networkId">[] = [];

    network.alternativeNames.forEach((value) => {
      alternativeNames.push({
        name: value.name,
        type: value.type,
      });
    });

    const images: PartialIdentifiableImage[] = [];

    network.images.forEach((value) => {
      images.push({
        id: value.id,
        fileType: value.fileType,
        filePath: value.filePath,
        width: value.width,
        height: value.height,
      });
    });

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateNetworkResponse>(
        insertRequest,
        {
          id: network.id,
          name: network.name,
          logo: network.logoPath,
          homepage: network.homepage,
          headquarters: network.headquarters,
          country_id: network.originCountry,
          alternativeNames: alternativeNames,
          images: images,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_networks_one);
  }

  /** @throws NotFoundException */
  async describe(networkId: number): Promise<NetworkWithContentCounts> {
    const fetchRequest = gql`
      query DescribeNetwork($id: numeric!) {
        dionysus_networks_by_pk(id: $id) {
          country {
            createdTime
            lastUpdatedTime
            name
            id
          }
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          createdTime
          headquarters
          homepage
          id
          logo
          name
          lastUpdatedTime
          images {
            createdTime
            filePath
            fileType
            height
            id
            lastUpdatedTime
            width
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
      await this.graphQLClient.request<GraphQlGetNetworkResponse>(
        fetchRequest,
        {
          id: networkId,
        },
      );

    if (!fetchResponse.dionysus_networks_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObjectWithContentCounts(
      fetchResponse.dionysus_networks_by_pk,
    );
  }

  /** A page of networks and the total count matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters: string | undefined,
  ): Promise<{ networks: NetworkWithContentCounts[]; count: number }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const queryParams = [paginationExpression];
    const where = buildFilterExpression(parseInFilters(filters));

    if (where) {
      queryParams.push(where);
    }

    const fetchRequest = gql`
      query ListNetworks {
        dionysus_networks(${queryParams.join(", ")}) {
          country {
            createdTime
            lastUpdatedTime
            name
            id
          }
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          createdTime
          headquarters
          homepage
          id
          logo
          name
          lastUpdatedTime
          images {
            createdTime
            filePath
            fileType
            height
            id
            lastUpdatedTime
            width
          }
          tvSeries_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_networks_aggregate${where ? `(${where})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListNetworksResponse>(
        fetchRequest,
      );

    return {
      networks: fetchResponse.dionysus_networks.map((result) =>
        toDomainObjectWithContentCounts(result),
      ),
      count: fetchResponse.dionysus_networks_aggregate.aggregate.count,
    };
  }

  /** A page of a network's TV series and their total count. @throws NotFoundException */
  async listTvSeries(
    networkId: number,
    pagination: PaginationParams,
  ): Promise<{ tvSeries: BaseTVSeries[]; count: number }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const queryParams = [paginationExpression];

    const fetchRequest = gql`
      query ListNetworkTvSeries($id: numeric!) {
        dionysus_networks_by_pk(id: $id) {
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
              posterPath
              status
              tagline
              type
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
      await this.graphQLClient.request<GraphQlListNetworkTvSeriesResponse>(
        fetchRequest,
        {
          id: networkId,
        },
      );
    if (!fetchResponse.dionysus_networks_by_pk) {
      throw new NotFoundException();
    }

    const tvSeries: BaseTVSeries[] = [];

    fetchResponse.dionysus_networks_by_pk.tvSeries.forEach((result) => {
      // Skip links to rows that are not in the database (yet).
      if (result.tvSeries) {
        tvSeries.push(toBaseDomainObject(result.tvSeries));
      }
    });

    return {
      tvSeries: tvSeries,
      count:
        fetchResponse.dionysus_networks_by_pk.tvSeries_aggregate.aggregate
          .count,
    };
  }
}

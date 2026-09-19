import { Country, PartialCountry } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { toDomainObject } from "../converters/CountryConverter";
import { GraphQlCountry } from "../types/country";

type GraphQlCreateCountryResponse = {
  insert_dionysus_countries_one: GraphQlCountry;
};

type GraphQlListCountriesResponse = {
  dionysus_countries: GraphQlCountry[];
  dionysus_countries_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

/** Countries in Hasura. */
@Injectable()
export class CountryService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a country. */
  async create(country: PartialCountry): Promise<Country> {
    const insertRequest = gql`
      mutation CreateCountry($id: String!, $name: String!) {
        insert_dionysus_countries_one(
          object: { id: $id, name: $name }
          on_conflict: { constraint: countries_pkey, update_columns: [name] }
        ) {
          id
          name
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateCountryResponse>(
        insertRequest,
        {
          id: country.id,
          name: country.name,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_countries_one);
  }

  /** A page of countries and the total count. */
  async list(
    pagination: PaginationParams,
  ): Promise<{ countries: Country[]; count: number }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const fetchRequest = gql`
      query ListCountries {
      dionysus_countries(${paginationExpression}) {
        createdTime
        id
        lastUpdatedTime
        name
      }
      dionysus_countries_aggregate {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListCountriesResponse>(
        fetchRequest,
      );

    return {
      countries: fetchResponse.dionysus_countries.map((result) =>
        toDomainObject(result),
      ),
      count: fetchResponse.dionysus_countries_aggregate.aggregate.count,
    };
  }
}

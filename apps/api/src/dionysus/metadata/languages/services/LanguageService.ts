import { Language, PartialLanguage } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { toDomainObject } from "../converters/LanguageConverter";
import { GraphQlLanguage } from "../types/language";

type GraphQlCreateLanguageResponse = {
  insert_dionysus_languages_one: GraphQlLanguage;
};

type GraphQlListLanguagesResponse = {
  dionysus_languages: GraphQlLanguage[];
  dionysus_languages_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

/** Languages in Hasura. */
@Injectable()
export class LanguageService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a language. */
  async create(language: PartialLanguage): Promise<Language> {
    const insertRequest = gql`
      mutation CreateLanguage(
        $id: String!
        $name: String!
        $nativeName: String!
      ) {
        insert_dionysus_languages_one(
          object: { id: $id, name: $name, nativeName: $nativeName }
          on_conflict: {
            constraint: languages_pkey
            update_columns: [name, nativeName]
          }
        ) {
          id
          name
          nativeName
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateLanguageResponse>(
        insertRequest,
        {
          id: language.id,
          name: language.name,
          nativeName: language.nativeName,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_languages_one);
  }

  /** A page of languages and the total count. */
  async list(
    pagination: PaginationParams,
  ): Promise<{ languages: Language[]; count: number }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const fetchRequest = gql`
      query ListLanguages {
      dionysus_languages(${paginationExpression}) {
        createdTime
        id
        lastUpdatedTime
        name
        nativeName
      }
      dionysus_languages_aggregate {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListLanguagesResponse>(
        fetchRequest,
      );

    return {
      languages: fetchResponse.dionysus_languages.map((result) =>
        toDomainObject(result),
      ),
      count: fetchResponse.dionysus_languages_aggregate.aggregate.count,
    };
  }
}

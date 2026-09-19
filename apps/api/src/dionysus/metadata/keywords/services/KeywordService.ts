import { Keyword, PartialKeyword } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { toDomainObject } from "../converters/KeywordConverter";
import { GraphQlKeyword } from "../types/keyword";

type GraphQlCreateKeywordResponse = {
  insert_dionysus_keywords_one: GraphQlKeyword;
};

type GraphQlListKeywordsResponse = {
  dionysus_keywords: GraphQlKeyword[];
  dionysus_keywords_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

/** Movie and TV keywords in Hasura. */
@Injectable()
export class KeywordService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a keyword. */
  async create(keyword: PartialKeyword): Promise<Keyword> {
    const insertRequest = gql`
      mutation CreateKeyword($id: numeric!, $value: String!) {
        insert_dionysus_keywords_one(
          object: { id: $id, value: $value }
          on_conflict: { constraint: keywords_pkey, update_columns: [value] }
        ) {
          id
          value
          createdTime
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateKeywordResponse>(
        insertRequest,
        {
          id: keyword.id,
          value: keyword.value,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_keywords_one);
  }

  /** A page of keywords and the total count. */
  async list(
    pagination: PaginationParams,
  ): Promise<{ keywords: Keyword[]; count: number }> {
    const paginationExpression = buildPaginationExpression(pagination);
    const fetchRequest = gql`
      query ListKeywords {
      dionysus_keywords(${paginationExpression}) {
        id
        value
        createdTime
        lastUpdatedTime
      }
      dionysus_keywords_aggregate {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListKeywordsResponse>(
        fetchRequest,
      );

    return {
      keywords: fetchResponse.dionysus_keywords.map((result) =>
        toDomainObject(result),
      ),
      count: fetchResponse.dionysus_keywords_aggregate.aggregate.count,
    };
  }
}

import {
  Language,
  ListLanguagesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/LanguageConverter";
import { GraphQlLanguage } from "../types/language";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { buildPaginationExpression } from "../../../../utils/filterUtil";

type GraphQlListLanguagesResponse = {
  dionysus_languages: GraphQlLanguage[];
  dionysus_languages_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListLanguagesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/languages")
  @ApiOperation({
    summary: "Lists languages",
    description:
      "Lists languages.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of languages fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListLanguages",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListLanguagesResponse,
    description:
      "The list of languages.  If there are more languages to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const paginationExpression = buildPaginationExpression({
      pageSize,
      startPage,
      sortField,
      sortDirection,
    });
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
    const fetchedLanguages: Language[] = [];

    fetchResponse.dionysus_languages.forEach((result) => {
      fetchedLanguages.push(toDomainObject(result));
    });

    const responseBody: ListLanguagesResponse = {
      languages: fetchedLanguages,
      count: fetchResponse.dionysus_languages_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

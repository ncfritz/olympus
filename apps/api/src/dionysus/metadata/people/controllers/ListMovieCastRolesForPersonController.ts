import {
  ListMovieCastRolesForPersonResponse,
  PersonMovieCastCredit,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseMovieCastDomainObject } from "../../converters/CastConverter";
import { toSparseDomainObject } from "../../movies/converters/MovieConverter";
import { SEARCH_CONFIGURATION } from "../../../media/searchConfigurations/queries/searchConfiguration";
import { GraphQlPersonMovieCastCredit } from "../../types/metadata";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";

type GraphQlListPersonCastCreditsResponse = {
  dionysus_movie_cast: GraphQlPersonMovieCastCredit[];
};

@Controller({ version: "1" })
export class ListMovieCastRolesForPersonController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/person/:personId/movie/cast")
  @ApiOperation({
    summary: "Lists a person's movie cast credits",
    description: "Lists the movies a person has cast credits for.",
    operationId: "ListMovieCastRolesForPerson",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "personId",
    type: Number,
    required: true,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListMovieCastRolesForPersonResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("personId", ParseIntPipe) personId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListMovieCastRolesForPerson($id: numeric!) {
        dionysus_movie_cast(
          where: { personId: { _eq: $id } }
          order_by: { movie: { releaseDate: desc } }
        ) {
          castId
          character
          createdTime
          creditId
          lastUpdatedTime
          movie {
            id
            adult
            backdropPath
            budget
            createdTime
            homepage
            imdbId
            lastUpdatedTime
            originalTitle
            overview
            posterPath
            releaseDate
            revenue
            runtime
            status
            tagline
            title
            video
            ${SEARCH_CONFIGURATION}
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListPersonCastCreditsResponse>(
        fetchRequest,
        { id: personId },
      );
    const credits: Map<number, PersonMovieCastCredit> = new Map();

    fetchResponse.dionysus_movie_cast.forEach((result) => {
      if (!result.movie) {
        return;
      }

      if (!credits.has(result.movie.id)) {
        credits.set(result.movie.id, {
          movie: toSparseDomainObject(result.movie),
          roles: [],
        });
      }

      // A person can have several roles on one movie.
      credits
        .get(result.movie.id)!
        .roles.push(toBaseMovieCastDomainObject(result));
    });

    const responseBody: ListMovieCastRolesForPersonResponse = {
      credits: [...credits.values()],
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

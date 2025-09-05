import {
  ListMovieCrewJobsForPersonResponse,
  PersonMovieCrewCredit,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toBaseMovieCrewDomainObject } from "../../../../convert/dionysus/metadata/CrewConverter";
import { toSparseDomainObject } from "../../../../convert/dionysus/metadata/MovieConverter";
import { GraphQlPersonMovieCrewCredit } from "../../../../types/dionysus/metadata";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";

type GraphQlListPersonCrewCreditsResponse = {
  dionysus_movie_crew: GraphQlPersonMovieCrewCredit[];
};

@Controller({ version: "1" })
export class ListMovieCrewJobsForPersonController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/person/:personId/movie/crew")
  @ApiOperation({
    summary: "Lists a person's movie crew credits",
    description: "Lists the movies a person has crew credits for.",
    operationId: "ListMovieCrewJobsForPerson",
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
    type: ListMovieCrewJobsForPersonResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("personId") personId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListPersonCrewCredits($id: numeric!) {
        dionysus_movie_crew(
          where: { personId: { _eq: $id } }
          order_by: { movie: { releaseDate: desc } }
        ) {
          createdTime
          creditId
          department
          job
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
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListPersonCrewCreditsResponse>(
        fetchRequest,
        { id: personId },
      );
    const credits: Map<number, PersonMovieCrewCredit> = new Map();

    fetchResponse.dionysus_movie_crew.forEach((result) => {
      if (!credits.has(result.movie.id)) {
        credits.set(result.movie.id, {
          movie: toSparseDomainObject(result.movie),
          jobs: [],
        });

        credits
          .get(result.movie.id)!
          .jobs.push(toBaseMovieCrewDomainObject(result));
      }
    });

    const responseBody: ListMovieCrewJobsForPersonResponse = {
      credits: [...credits.values()],
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

import { ListMovieCrewResponse, MovieCrewMember } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toMovieCrewDomainObject } from "../../../../convert/dionysus/metadata/CrewConverter";
import { GraphQlMovieCrewMember } from "../../../../types/dionysus/metadata";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListMovieCrewResponse = {
  dionysus_movie_crew: GraphQlMovieCrewMember[];
};

@Controller({ version: "1" })
export class ListMovieCrewController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movie/:movieId/crew")
  @ApiOperation({
    summary: "Lists movie crew members",
    description:
      "Lists the full crew for a movie.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieCrew",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieCrewResponse,
    description: "The list of movie crew members.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId") movieId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListMovieCrewMembers($id: numeric!) {
        dionysus_movie_crew(where: { movieId: { _eq: $id } }) {
          createdTime
          creditId
          department
          job
          lastUpdatedTime
          originalName
          person {
            adult
            birthday
            birthplace
            createdTime
            deathday
            gender
            homepage
            id
            imdbId
            knownForDepartment
            lastUpdatedTime
            name
            profilePath
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieCrewResponse>(
        fetchRequest,
        { id: movieId },
      );
    const crew: MovieCrewMember[] = [];

    fetchResponse.dionysus_movie_crew.forEach((result) => {
      if (result.person) {
        crew.push(toMovieCrewDomainObject(result));
      }
    });

    const responseBody: ListMovieCrewResponse = {
      crew: crew,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

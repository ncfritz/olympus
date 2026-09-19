import {
  Genre,
  CreateGenreRequest,
  CreateGenreResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/GenreConverter";
import { GraphQlGenre } from "../types/genre";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateGenreResponse = {
  insert_dionysus_genres_one: GraphQlGenre;
};

@Controller({ version: "1" })
export class CreateGenreController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/metadata/genres")
  @ApiOperation({
    summary: "Upserts a Movie or TV genre",
    description: "Creates or updates a movie or TV genre.",
    operationId: "CreateGenre",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateGenreRequest,
    required: true,
    description: "Input for the CreateGenre operation",
  })
  @ApiCreatedResponse({
    type: CreateGenreResponse,
    description: "The record has been successfully created.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateGenreRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateGenre($id: numeric!, $name: String!, $type: String!) {
        insert_dionysus_genres_one(
          object: { id: $id, name: $name, type: $type }
          on_conflict: { constraint: genres_pkey, update_columns: [name] }
        ) {
          id
          name
          createdTime
          type
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateGenreResponse>(
        insertRequest,
        {
          id: request.genre.id,
          name: request.genre.name,
          type: request.genre.type,
        },
      );

    const createdGenre: Genre = toDomainObject(
      insertResponse.insert_dionysus_genres_one,
    );

    const responseBody: CreateGenreResponse = {
      genre: createdGenre,
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}

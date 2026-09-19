import {
  Collection,
  ListMovieCollectionsResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
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
import { toDomainObject } from "../../../../convert/dionysus/metadata/CollectionConverter";
import { MEDIA_ASSET } from "../../../../query/dionysus/media/mediaAsset";
import { SEARCH_CONFIGURATION } from "../../../../query/dionysus/media/searchConfigutation";
import {
  GraphQlCollection,
  Timestamped,
} from "../../../../types/dionysus/metadata";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlListMovieCollectionsResponse = {
  dionysus_movies_by_pk: {
    collections: Timestamped &
      {
        collection: GraphQlCollection;
      }[];
  };
};

@Controller({ version: "1" })
export class ListMovieCollectionsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movie/:movieId/collections")
  @ApiOperation({
    summary: "Lists the collections a movie belongs to",
    description:
      "Lists the set of collections a movie belongs to.  This API will return the collection details including the " +
      "parts (movies) that belong to collection.  This API is not paginated and does not support filtering.",
    operationId: "ListMovieCollections",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    type: ListMovieCollectionsResponse,
    description: "The list of collections the movie belongs to.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId", ParseIntPipe) movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListMovieCollections($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          collections {
            createdTime
            lastUpdatedTime
            collection {
              backdropPath
              createdTime
              id
              images {
                createdTime
                filePath
                height
                language {
                  createdTime
                  id
                  lastUpdatedTime
                  name
                  nativeName
                }
                lastUpdatedTime
                type
                width
              }
              name
              overview
              posterPath
              parts {
                createdTime
                lastUpdatedTime
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
                  posterPath
                  releaseDate
                  revenue
                  runtime
                  status
                  tagline
                  title
                  video
                  ${SEARCH_CONFIGURATION}
                  ${MEDIA_ASSET}
                }
              }
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMovieCollectionsResponse>(
        fetchRequest,
        { id: movieId },
      );
    if (!fetchResponse.dionysus_movies_by_pk) {
      throw new NotFoundException();
    }

    const collections: Collection[] = [];

    fetchResponse.dionysus_movies_by_pk.collections.forEach((result) => {
      collections.push(toDomainObject(result.collection));
    });

    const responseBody: ListMovieCollectionsResponse = {
      collections: collections,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

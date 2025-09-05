import { Collection, DescribeCollectionResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlCollection } from "../../../../types/dionysus/metadata";
import { toDomainObject } from "../../../../convert/dionysus/metadata/CollectionConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetCollectionResponse = {
  dionysus_collections_by_pk: GraphQlCollection;
};

@Controller({ version: "1" })
export class DescribeCollectionController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/collection/:collectionId")
  @ApiOperation({
    summary: "Describes a collection in Dionysus",
    description: "Retrieves the details of a collection in Dionysus.",
    operationId: "DescribeCollection",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "collectionId",
    description: "The ID of the collection to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeCollectionResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("collectionId") collectionId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query FetchCollection($id: numeric!) {
        dionysus_collections_by_pk(id: $id) {
          backdropPath
          createdTime
          id
          images {
            createdTime
            filePath
            height
            language {
              id
              createdTime
              lastUpdatedTime
              name
              nativeName
            }
            lastUpdatedTime
            type
            width
          }
          lastUpdatedTime
          name
          overview
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
            }
          }
          posterPath
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetCollectionResponse>(
        fetchRequest,
        {
          id: collectionId,
        },
      );

    if (!fetchResponse.dionysus_collections_by_pk) {
      throw new NotFoundException();
    }

    const fetchedCollection: Collection = toDomainObject(
      fetchResponse.dionysus_collections_by_pk,
    );

    const responseBody: DescribeCollectionResponse = {
      collection: fetchedCollection,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

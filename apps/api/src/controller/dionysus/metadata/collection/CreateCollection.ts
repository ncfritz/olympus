import {
  CreateCollectionRequest,
  CreateCollectionResponse,
  PartialCollectionPart,
  PartialTypedImage,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateCollectionInput = {
  id: number;
  name: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  parts: PartialCollectionPart[];
  images: PartialTypedImage[];
};

type GraphQlCreateCollectionResponse = {
  insert_dionysus_collections_one: {
    id: number;
  };
};

@Controller({ version: "1" })
export class CreateCollectionController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/metadata/collections")
  @ApiOperation({
    summary: "Upserts a collection",
    description: "Creates or updates a collection.",
    operationId: "CreateCollection",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCollectionRequest,
    required: true,
    description: "Input for the CreateCollection operation",
  })
  @ApiCreatedResponse({
    type: CreateCollectionResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        description: "The location of the created collection",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCollectionRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateCollection(
        $id: numeric!
        $name: String!
        $overview: String!
        $posterPath: String
        $backdropPath: String
        $parts: [dionysus_collection_parts_insert_input!]!
        $images: [dionysus_collection_images_insert_input!]!
      ) {
        insert_dionysus_collections_one(
          object: {
            id: $id
            name: $name
            overview: $overview
            posterPath: $posterPath
            backdropPath: $backdropPath
            parts: {
              on_conflict: {
                constraint: collection_parts_pkey
                update_columns: [movieId]
              }
              data: $parts
            }
            images: {
              on_conflict: {
                constraint: collection_images_pkey
                update_columns: [width, height, languageCode]
              }
              data: $images
            }
          }
          on_conflict: {
            constraint: collections_pkey
            update_columns: [name, overview, posterPath, backdropPath]
          }
        ) {
          id
        }
      }
    `;

    const insertResponse = await this.graphQLClient.request<
      GraphQlCreateCollectionResponse,
      GraphQlCreateCollectionInput
    >(insertRequest, {
      id: request.collection.id,
      name: request.collection.name,
      overview: request.collection.overview,
      posterPath: request.collection.posterPath,
      backdropPath: request.collection.backdropPath,
      parts: request.collection.parts,
      images: request.collection.images,
    });

    const responseBody: CreateCollectionResponse = {
      id: insertResponse.insert_dionysus_collections_one.id,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api//metdata/collection/${insertResponse.insert_dionysus_collections_one.id}`,
      )
      .send(responseBody);
  }
}

import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  CreateCollectionRequest,
  PartialCollectionImage,
  PartialCollectionPart,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlCreateCollectionInput = {
  id: number;
  name: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  parts: PartialCollectionPart[];
  images: PartialCollectionImage[];
};

type GraphQlCreateCollectionResponse = {
  insert_dionysus_collections_one: {
    id: string;
  };
};

@Controller()
export class CreateCollectionController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Put("/v1/metadata/collections")
  @ApiOperation({
    summary: "Upserts a collection",
    description: "Creates or updates a collection.",
    operationId: "CreateCollection",
  })
  @ApiTags("Metadata")
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCollectionRequest,
    required: true,
    description: "Input for the CreateCollection operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateCollectionRequest,
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
        $posterPath: String!
        $backdropPath: String!
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
                update_columns: [width, height, countryCode]
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

    console.log(insertResponse);

    const responseBody = {
      id: insertResponse.insert_dionysus_collections_one.id,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/metdata/collection/${insertResponse.insert_dionysus_collections_one.id}`,
      )
      .send(responseBody);
  }
}

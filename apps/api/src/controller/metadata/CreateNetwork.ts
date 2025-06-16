import {
  CreateNetworkRequest,
  PartialNetworkAlternativeName,
  PartialNetworkImage,
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
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlCreateNetworkResponse = {
  insert_dionysus_networks_one: {
    id: string;
  };
};

@Controller()
export class CreateNetworkController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/v1/metadata/networks")
  @ApiOperation({
    summary: "Upserts a network",
    description: "Creates or updates a network.",
    operationId: "CreateNetwork",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateNetworkRequest,
    required: true,
    description: "Input for the CreateNetwork operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateNetworkRequest,
    headers: {
      Location: {
        description: "The location of the created network",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateNetworkRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateNetwork(
        $country_id: String!
        $headquarters: String!
        $homepage: String!
        $id: numeric!
        $logo: String
        $name: String!
        $alternativeNames: [dionysus_network_alternative_names_insert_input!]!
        $images: [dionysus_network_images_insert_input!]!
      ) {
        insert_dionysus_networks_one(
          object: {
            name: $name
            logo: $logo
            id: $id
            homepage: $homepage
            headquarters: $headquarters
            country_id: $country_id
            alternativeNames: {
              on_conflict: {
                constraint: network_alternative_name_pkey
                update_columns: [name, type]
              }
              data: $alternativeNames
            }
            images: {
              on_conflict: {
                constraint: network_images_pkey
                update_columns: [id, filePath, fileType, width, height]
              }
              data: $images
            }
          }
          on_conflict: {
            constraint: networks_pkey
            update_columns: [name, logo, homepage, headquarters, country_id]
          }
        ) {
          id
        }
      }
    `;

    const alternativeNames: Omit<PartialNetworkAlternativeName, "networkId">[] =
      [];

    request.network.alternativeNames.forEach((value) => {
      alternativeNames.push({
        name: value.name,
        type: value.type,
      });
    });

    const images: Omit<PartialNetworkImage, "networkId">[] = [];

    request.network.logos.forEach((value) => {
      images.push({
        id: value.id,
        fileType: value.fileType,
        filePath: value.filePath,
        width: value.width,
        height: value.height,
      });
    });

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateNetworkResponse>(
        insertRequest,
        {
          id: request.network.id,
          name: request.network.name,
          logo: request.network.logoPath,
          homepage: request.network.homepage,
          headquarters: request.network.headquarters,
          country_id: request.network.originCountry,
          alternativeNames: alternativeNames,
          images: images,
        },
      );

    console.log(insertResponse);

    const responseBody = {
      id: insertResponse.insert_dionysus_networks_one.id,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/metdata/network/${insertResponse.insert_dionysus_networks_one.id}`,
      )
      .send(responseBody);
  }
}

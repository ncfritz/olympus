import { DescribeNetworkResponse } from "@ncfritz/olympus-model";
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
import { toDomainObjectWithContentCounts } from "../../../../convert/dionysus/metadata/NetworkConverter";
import { GraphQlNetworkWithContentCounts } from "../../../../types/dionysus/metadata/tvNetworks";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetNetworkResponse = {
  dionysus_networks_by_pk: GraphQlNetworkWithContentCounts;
};

@Controller({ version: "1" })
export class DescribeNetworkController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/network/:networkId")
  @ApiOperation({
    summary: "Describes a network in Dionysus",
    description: "Retrieves the details of a network in Dionysus.",
    operationId: "DescribeNetwork",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "networkId",
    description: "The ID of the network to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeNetworkResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("networkId", ParseIntPipe) networkId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeNetwork($id: numeric!) {
        dionysus_networks_by_pk(id: $id) {
          country {
            createdTime
            lastUpdatedTime
            name
            id
          }
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          createdTime
          headquarters
          homepage
          id
          logo
          name
          lastUpdatedTime
          images {
            createdTime
            filePath
            fileType
            height
            id
            lastUpdatedTime
            width
          }
          tvSeries_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetNetworkResponse>(
        fetchRequest,
        {
          id: networkId,
        },
      );

    if (!fetchResponse.dionysus_networks_by_pk) {
      throw new NotFoundException();
    }

    const fetchedNetwork = toDomainObjectWithContentCounts(
      fetchResponse.dionysus_networks_by_pk,
    );

    const responseBody: DescribeNetworkResponse = {
      network: fetchedNetwork,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

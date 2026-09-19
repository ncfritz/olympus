import {
  DescribeProductionCompanyResponse,
  FullProductionCompany,
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
import { GraphQlFullProductionCompany } from "../../../../types/dionysus/metadata/productionCompany";
import { toFullDomainObject } from "../../../../convert/dionysus/metadata/ProductionCompanyConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetProductionCompanyResponse = {
  dionysus_production_companies_by_pk: GraphQlFullProductionCompany;
};

@Controller({ version: "1" })
export class DescribeProductionCompanyController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/productionCompany/:productionCompanyId")
  @ApiOperation({
    summary: "Describes a production company in Dionysus",
    description: "Retrieves the details of a production company in Dionysus.",
    operationId: "DescribeProductionCompany",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "productionCompanyId",
    description: "The ID of the production company to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeProductionCompanyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("productionCompanyId", ParseIntPipe) productionCompanyId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeProductionCompany($id: numeric!) {
        dionysus_production_companies_by_pk(id: $id) {
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          country {
            id
            createdTime
            lastUpdatedTime
            name
          }
          createdTime
          description
          headquarters
          homepage
          id
          lastUpdatedTime
          logo
          name
          logos {
            createdTime
            filePath
            fileType
            height
            id
            lastUpdatedTime
            width
          }
          children {
            alternativeNames {
              createdTime
              lastUpdatedTime
              name
              type
            }
            country {
              id
              createdTime
              lastUpdatedTime
              name
            }
            createdTime
            description
            headquarters
            homepage
            id
            lastUpdatedTime
            logo
            name
            movies_aggregate {
              aggregate {
                count
              }
            }
            tvSeries_aggregate {
              aggregate {
                count
              }
            }
          }
          parent {
            alternativeNames {
              createdTime
              lastUpdatedTime
              name
              type
            }
            country {
              createdTime
              lastUpdatedTime
              name
            }
            createdTime
            description
            headquarters
            homepage
            id
            lastUpdatedTime
            logo
            name
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetProductionCompanyResponse>(
        fetchRequest,
        {
          id: productionCompanyId,
        },
      );

    if (!fetchResponse.dionysus_production_companies_by_pk) {
      throw new NotFoundException();
    }

    const fetchedProductionCompany: FullProductionCompany = toFullDomainObject(
      fetchResponse.dionysus_production_companies_by_pk,
    );

    const responseBody: DescribeProductionCompanyResponse = {
      company: fetchedProductionCompany,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

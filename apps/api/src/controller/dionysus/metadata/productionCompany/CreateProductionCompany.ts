import {
  CreateProductionCompanyRequest,
  CreateProductionCompanyResponse,
  PartialAlternativeName,
  PartialIdentifiableImage,
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
import { toSparseDomainObject as toSparseProductionCompanyDomainObject } from "../../../../convert/dionysus/metadata/ProductionCompanyConverter";
import { GraphQlSparseProductionCompany } from "../../../../types/dionysus/metadata/productionCompany";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlCreateProductionCompanyResponse = {
  insert_dionysus_production_companies_one: GraphQlSparseProductionCompany;
};

@Controller({ version: "1" })
export class CreateProductionCompanyController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/metadata/productionCompanies")
  @ApiOperation({
    summary: "Upserts a production company",
    description: "Creates or updates a production company.",
    operationId: "CreateProductionCompany",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateProductionCompanyRequest,
    required: true,
    description: "Input for the CreateProductionCompany operation",
  })
  @ApiCreatedResponse({
    type: CreateProductionCompanyResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created production company1",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateProductionCompanyRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateProductionCompany(
        $country_id: String
        $description: String!
        $headquarters: String!
        $homepage: String!
        $id: numeric!
        $logo: String
        $name: String!
        $parent_company: numeric
        $alternativeNames: [dionysus_production_company_alternative_names_insert_input!]!
        $logos: [dionysus_production_company_logos_insert_input!]!
      ) {
        insert_dionysus_production_companies_one(
          object: {
            parent_company: $parent_company
            name: $name
            logo: $logo
            id: $id
            homepage: $homepage
            headquarters: $headquarters
            description: $description
            country_id: $country_id
            alternativeNames: {
              on_conflict: {
                constraint: production_companies_alternative_names_pkey
                update_columns: [name, type]
              }
              data: $alternativeNames
            }
            logos: {
              on_conflict: {
                constraint: production_company_logos_pkey
                update_columns: [id, filePath, fileType, width, height]
              }
              data: $logos
            }
          }
          on_conflict: {
            constraint: production_companies_pkey
            update_columns: [
              name
              logo
              homepage
              headquarters
              description
              country_id
              parent_company
            ]
          }
        ) {
          alternativeNames {
            createdTime
            lastUpdatedTime
            name
            type
          }
          country {
            createdTime
            id
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
    `;

    const alternativeNames: PartialAlternativeName[] = [];

    request.company.alternativeNames.forEach((value) => {
      alternativeNames.push({
        name: value.name,
        type: value.type,
      });
    });

    const logos: PartialIdentifiableImage[] = [];

    request.company.logos.forEach((value) => {
      logos.push({
        id: value.id,
        fileType: value.fileType,
        filePath: value.filePath,
        width: value.width,
        height: value.height,
      });
    });

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateProductionCompanyResponse>(
        insertRequest,
        {
          id: request.company.id,
          name: request.company.name,
          logo: request.company.logoPath,
          description: request.company.description,
          homepage: request.company.homepage,
          headquarters: request.company.headquarters,
          country_id: request.company.originCountry,
          parent_company: request.company.parentCompanyId,
          alternativeNames: alternativeNames,
          logos: logos,
        },
      );

    const responseBody: CreateProductionCompanyResponse = {
      company: toSparseProductionCompanyDomainObject(
        insertResponse.insert_dionysus_production_companies_one,
      ),
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api//metdata/productionCompanies/${insertResponse.insert_dionysus_production_companies_one.id}`,
      )
      .send(responseBody);
  }
}

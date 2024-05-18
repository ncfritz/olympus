import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  CreateProductionCompanyRequest,
  PartialProductionCompanyAlternativeName,
  PartialProductionCompanyLogo,
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

type GraphQlCreateProductionCompanyResponse = {
  insert_dionysus_production_companies_one: {
    id: string;
  };
};

@Controller()
export class CreateProductionCompanyController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Put("/v1/metadata/productionCompanies")
  @ApiOperation({
    summary: "Upserts a production company",
    description: "Creates or updates a production company.",
    operationId: "CreateProductionCompany",
  })
  @ApiTags("Metadata")
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateProductionCompanyRequest,
    required: true,
    description: "Input for the CreateProductionCompany operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateProductionCompanyRequest,
    headers: {
      Location: {
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
        $country_id: String!
        $description: String!
        $headquarters: String!
        $homepage: String!
        $id: numeric!
        $logo: String!
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
          id
        }
      }
    `;

    const alternativeNames: Omit<
      PartialProductionCompanyAlternativeName,
      "productionCompanyId"
    >[] = [];

    request.company.alternativeNames.forEach((value) => {
      alternativeNames.push({
        name: value.name,
        type: value.type,
      });
    });

    const logos: Omit<PartialProductionCompanyLogo, "productionCompanyId">[] =
      [];

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

    console.log(insertResponse);

    const responseBody = {
      id: insertResponse.insert_dionysus_production_companies_one.id,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/metdata/productionCompanies/${insertResponse.insert_dionysus_production_companies_one.id}`,
      )
      .send(responseBody);
  }
}

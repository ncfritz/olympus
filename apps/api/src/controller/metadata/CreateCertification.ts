import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  Certification,
  CreateCertificationRequest,
  CreateCertificationResponse,
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
import { toDomainObject } from "../../convert/metadata/CertificationConverter";
import { GraphQlCertification } from "../../types/batchJobs";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlCreateCertificationResponse = {
  insert_dionysus_certifications_one: GraphQlCertification;
};

@Controller()
export class CreateCertificationController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Put("/v1/metadata/certifications")
  @ApiOperation({
    summary: "Upserts a Movie or TV certification",
    description: "Creates or updates a movie or TV certification.",
    operationId: "CreateCertification",
  })
  @ApiTags("Metadata")
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCertificationRequest,
    required: true,
    description: "Input for the CreateCertification operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateCertificationRequest,
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCertificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreateCertification(
        $country: String!
        $certification: String!
        $type: String!
        $meaning: String!
        $order: numeric
      ) {
        insert_dionysus_certifications_one(
          object: {
            certification: $certification
            country: $country
            meaning: $meaning
            order: $order
            type: $type
          }
          on_conflict: {
            constraint: certifications_pkey
            update_columns: [meaning, order]
          }
        ) {
          certification
          country
          createdTime
          meaning
          order
          type
          lastUpdatedTime
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateCertificationResponse>(
        insertRequest,
        {
          country: request.certification.country,
          certification: request.certification.certification,
          type: request.certification.type,
          order: request.certification.order,
          meaning: request.certification.meaning,
        },
      );

    const createdCertification: Certification = toDomainObject(
      insertResponse.insert_dionysus_certifications_one,
    );

    const responseBody: CreateCertificationResponse = {
      certification: createdCertification,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/metdata/certification/${
          createdCertification.country
        }/${createdCertification.type}/${encodeURIComponent(
          createdCertification.certification,
        )}`,
      )
      .send(responseBody);
  }
}

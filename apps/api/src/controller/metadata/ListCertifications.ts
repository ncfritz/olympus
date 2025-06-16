import {
  Certification,
  ListCertificationsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/metadata/CertificationConverter";
import { GraphQlCertification } from "../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../utils/controllerDecorators";

type GraphQlListCertificationsResponse = {
  dionysus_certifications: GraphQlCertification[];
  dionysus_certifications_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller()
export class ListCertificationsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/metadata/certifications")
  @ApiOperation({
    summary: "Lists certifications",
    description:
      "Lists certifications.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of certifications fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListCertifications",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of certifications.  If there are more certifications to list, a pagination token will be present.",
    type: () => ListCertificationsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListCertifications {
        dionysus_certifications(limit: ${pageSize}, offset: ${
          pageSize * startPage
        }, order_by: {${sortField}: ${sortDirection}}) {
          certification
          country
          createdTime
          lastUpdatedTime
          meaning
          order
          type
        }
        dionysus_certifications_aggregate {
          aggregate {
            count
          }
       }
      }`;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListCertificationsResponse>(
        fetchRequest,
      );
    const fetchedCertifications: Certification[] = [];

    fetchResponse.dionysus_certifications.forEach((result) => {
      fetchedCertifications.push(toDomainObject(result));
    });

    const responseBody: ListCertificationsResponse = {
      certifications: fetchedCertifications,
      count: fetchResponse.dionysus_certifications_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

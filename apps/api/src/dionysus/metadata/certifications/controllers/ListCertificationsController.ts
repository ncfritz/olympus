import {
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
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { CertificationService } from "../services/CertificationService";

@Controller({ version: "1" })
export class ListCertificationsController {
  constructor(private readonly certifications: CertificationService) {}

  @Get("/metadata/certifications")
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
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListCertificationsResponse,
    description:
      "The list of certifications.  If there are more certifications to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { certifications, count } = await this.certifications.list(
      {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      },
      filters,
    );

    const responseBody: ListCertificationsResponse = {
      certifications: certifications,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

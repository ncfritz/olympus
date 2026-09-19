import { ListPeopleResponse, SortDirection } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { PersonService } from "../services/PersonService";

@Controller({ version: "1" })
export class ListPeopleController {
  constructor(private readonly people: PersonService) {}

  @Get("/metadata/people")
  @ApiOperation({
    summary: "Lists people",
    description:
      "Lists people.  This API accepts pagination and filter parameters to refine the " +
      "list of people fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListPeople",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of people.  If there are more people to list, a pagination token will be present.",
    type: () => ListPeopleResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "popularity",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { people, count } = await this.people.list(
      {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      },
      filters,
    );

    const responseBody: ListPeopleResponse = {
      people: people,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

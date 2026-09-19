import {
  ListContentAssetsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Req, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response, type Request } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { parseFilterDefinition } from "../../../../utils/filterUtil";
import { ContentAssetService } from "../services/ContentAssetService";
import { contentAuthToken } from "../../auth/contentAuth";

@Controller({ version: "1" })
export class ListContentAssetsController {
  constructor(private readonly contentAssets: ContentAssetService) {}

  @Get("/content/assets")
  @ApiOperation({
    summary: "Lists content assets",
    description:
      "Lists content assets.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of assets fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListContentAssets",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiHeader({
    name: "x-dionysus-content-bc",
    description:
      "Ignored; kept for SDK compatibility. The black curtain applies to every request without a valid content auth cookie.",
    required: false,
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of assets.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListContentAssetsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListContentAssetsResponse =
      await this.contentAssets.list(
        parseFilterDefinition(filters),
        {
          pageSize: pageSize,
          startPage: startPage,
          sortDirection: sortDirection,
          sortField: sortField,
          fallbackSort: {
            sortField: "createdTime",
            sortDirection: SortDirection.DESC,
          },
        },
        contentAuthToken(request),
      );

    response.status(HttpStatus.OK).send(responseBody);
  }
}

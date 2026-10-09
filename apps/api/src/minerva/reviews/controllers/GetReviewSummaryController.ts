import { GetReviewSummaryResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";
import { ReviewSummaryService } from "../services/ReviewSummaryService";

@Controller({ version: "1" })
export class GetReviewSummaryController {
  constructor(private readonly summaries: ReviewSummaryService) {}

  @Get("/reviews/summary")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets the summary of the signed-in user's reviews over a range",
    description:
      "For every day, or every week named by its Monday, from one date to another: its status (complete, draft, missed, open or upcoming, today deciding which), ratings and headline; the averages of the range's completed reviews against as many periods before; the counts; and the current and best streaks. The range is at most 400 days.",
    operationId: "GetReviewSummary",
    tags: ["Reviews"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "kind",
    required: true,
    type: String,
    description: "daily or weekly",
  })
  @ApiQuery({
    name: "from",
    required: true,
    type: String,
    description: "The first day, or the first week's Monday, as YYYY-MM-DD",
  })
  @ApiQuery({
    name: "to",
    required: true,
    type: String,
    description: "The last day, or the last week's Monday, as YYYY-MM-DD",
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiOkResponse({
    type: GetReviewSummaryResponse,
    description: "The summary of the range.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("kind") kind: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @HeaderTimezone() tz: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: GetReviewSummaryResponse = {
      summary: await this.summaries.summarise(user.userId, kind, from, to, tz),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

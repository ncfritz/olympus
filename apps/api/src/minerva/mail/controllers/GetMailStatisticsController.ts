import {
  GetMailStatisticsResponse,
  MailStatisticsRange,
  MailStatisticsScope,
} from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseEnumPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailStatisticsService } from "../services/MailStatisticsService";

@Controller({ version: "1" })
export class GetMailStatisticsController {
  constructor(private readonly statistics: MailStatisticsService) {}

  @Get("/mail/statistics")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets statistics over the caller's mail",
    description:
      "The Statistics page's numbers (docs/plans/email-management phase 2): totals, the busiest senders and labels, and their mail per year, over the caller's mail accounts in the range and scope. Computed from the stored metadata on each request.",
    operationId: "GetMailStatistics",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "range",
    description: "How far back to look; the last twelve months by default",
    enum: MailStatisticsRange,
    enumName: "MailStatisticsRange",
    enumSchema: { description: "How far back mail statistics look" },
    required: false,
  })
  @ApiQuery({
    name: "scope",
    description: "Which messages to count; all by default",
    enum: MailStatisticsScope,
    enumName: "MailStatisticsScope",
    enumSchema: { description: "Which messages mail statistics count" },
    required: false,
  })
  @ApiOkResponse({
    description: "The statistics.",
    type: GetMailStatisticsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(
      "range",
      new DefaultValuePipe(MailStatisticsRange.TwelveMonths),
      new ParseEnumPipe(MailStatisticsRange),
    )
    range: MailStatisticsRange,
    @Query(
      "scope",
      new DefaultValuePipe(MailStatisticsScope.All),
      new ParseEnumPipe(MailStatisticsScope),
    )
    scope: MailStatisticsScope,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: GetMailStatisticsResponse = await this.statistics.getStatistics(
      user.userId,
      range,
      scope,
    );
    response.status(HttpStatus.OK).send(body);
  }
}

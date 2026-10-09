import { ListMailFilterProposalsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
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
import { MailFilterService } from "../services/MailFilterService";

@Controller({ version: "1" })
export class ListMailFilterProposalsController {
  constructor(private readonly filters: MailFilterService) {}

  @Get("/mail/filter-proposals")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the Gmail filters worth making",
    description:
      "Filter proposals (docs/plans/email-management phase 7): a sender with at least 20 messages approved in the inbox, at least 99% of which carry one user label now, proposed a filter applying it as the mail arrives. Most approvals first, up to 200; a sender with a filter for the label, or a proposal declined, is left out.",
    operationId: "ListMailFilterProposals",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "accountId",
    description: "Only this mail account's",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "The list, possibly empty.",
    type: ListMailFilterProposalsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("accountId") accountId: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailFilterProposalsResponse = {
      proposals: await this.filters.proposals(user.userId, accountId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

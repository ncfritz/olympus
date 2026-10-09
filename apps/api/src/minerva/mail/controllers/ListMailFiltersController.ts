import { ListMailFiltersResponse } from "@ncfritz/olympus-model";
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
export class ListMailFiltersController {
  constructor(private readonly filters: MailFilterService) {}

  @Get("/mail/filters")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the Gmail filters made from proposals",
    description:
      "The filters made with CreateMailFilter (docs/plans/email-management phase 7), newest first: each a sender, the label it applies, and whether its mail skips the inbox. Inbox mail from the sender carrying the label is handled, out of review.",
    operationId: "ListMailFilters",
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
    type: ListMailFiltersResponse,
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
    const body: ListMailFiltersResponse = {
      filters: await this.filters.filters(user.userId, accountId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

import {
  CreateMailFilterRequest,
  CreateMailFilterResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
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
export class CreateMailFilterController {
  constructor(private readonly filters: MailFilterService) {}

  @Post("/mail/account/:accountId/filters")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Makes a Gmail filter for a sender",
    description:
      "Approves a filter proposal (docs/plans/email-management phase 7): the mail agent makes a filter in Gmail applying the label to the sender's mail as it arrives, and archiving it too when `skipInbox`; Minerva keeps it, and the sender's inbox mail carrying the label leaves review. Needs writes on (MINERVA_MAIL_WRITES_ENABLED), the agent's MAIL_FILTERS_ENABLED and a mailbox linked with gmail.settings.basic (\"Allow filters\"). Mail already received is not changed.",
    operationId: "CreateMailFilter",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account",
    type: String,
  })
  @ApiBody({
    type: CreateMailFilterRequest,
    required: true,
    description: "Input for the CreateMailFilter operation",
  })
  @ApiCreatedResponse({
    description: "The filter was made in Gmail.",
    type: CreateMailFilterResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account of the caller's, or no such user label.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      "The sender has a filter for the label already, or the mailbox is not linked for filters.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Writes or filters are turned off.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: CreateMailFilterRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: CreateMailFilterResponse = {
      filter: await this.filters.create(user.userId, accountId, request),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}

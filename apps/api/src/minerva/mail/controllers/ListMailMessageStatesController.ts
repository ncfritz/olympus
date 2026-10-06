import { ListMailMessageStatesResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MAX_STATE_PAGE, MailSyncService } from "../services/MailSyncService";

@Controller({ version: "1" })
export class ListMailMessageStatesController {
  constructor(private readonly sync: MailSyncService) {}

  @Get("/mail/account/:accountId/message-states")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists an account's messages' labels and flags",
    description:
      "For the mail agent's reconcile with Gmail (docs/plans/email-management phase 1b): a page of the account's messages by Gmail ID, each with its user labels, categories and flags as Minerva has them, to compare with Gmail's. Pass the answer's `nextCursor` as `after` for the next page.",
    operationId: "ListMailMessageStates",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account",
    type: String,
  })
  @ApiQuery({
    name: "after",
    description:
      "Only messages after this Gmail ID: the last page's nextCursor",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: `How many messages, 1 to ${MAX_STATE_PAGE}; 5000 by default`,
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "A page of messages.",
    type: ListMailMessageStatesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No client certificate, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an agent.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("accountId") accountId: string,
    @Query("after") after: string | undefined,
    @Query("limit", new DefaultValuePipe(MAX_STATE_PAGE), ParseIntPipe)
    limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const body: ListMailMessageStatesResponse = await this.sync.listStates(
      accountId,
      after,
      limit,
    );
    response.status(HttpStatus.OK).send(body);
  }
}

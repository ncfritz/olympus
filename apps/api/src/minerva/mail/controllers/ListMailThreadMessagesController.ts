import { ListMailThreadMessagesResponse } from "@ncfritz/olympus-model";
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
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  MAIL_THREAD_MAX_PAGE_SIZE,
  MailAuditService,
} from "../services/MailAuditService";

@Controller({ version: "1" })
export class ListMailThreadMessagesController {
  constructor(private readonly audit: MailAuditService) {}

  @Get("/mail/account/:accountId/thread/:threadId/messages")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists a thread's messages",
    description: `A page of one thread's messages, oldest first, each with its sender, subject, when it was received and its user labels: the Re-classification page's Threads tab, where a thread's messages disagree on their labels. Up to ${MAIL_THREAD_MAX_PAGE_SIZE} a page. Metadata only, never the text.`,
    operationId: "ListMailThreadMessages",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account",
    type: String,
  })
  @ApiParam({
    name: "threadId",
    description: "The thread's Gmail ID",
    type: String,
  })
  @ApiQuery({
    name: "pageSize",
    description: `How many a page, up to ${MAIL_THREAD_MAX_PAGE_SIZE}`,
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "startPage",
    description: "The page, from 0",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "A page of the thread's messages, and how many it has.",
    type: ListMailThreadMessagesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Param("threadId") threadId: string,
    @Query("pageSize", new DefaultValuePipe(10), ParseIntPipe)
    pageSize: number,
    @Query("startPage", new DefaultValuePipe(0), ParseIntPipe)
    startPage: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailThreadMessagesResponse =
      await this.audit.threadMessages(user.userId, {
        accountId,
        threadId,
        pageSize,
        startPage,
      });
    response.status(HttpStatus.OK).send(body);
  }
}

import {
  ListMailInboxResponse,
  MailInboxSort,
  MailInboxStatus,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseEnumPipe,
  ParseFloatPipe,
  ParseIntPipe,
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
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";
import { MailInboxService } from "../services/MailInboxService";

@Controller({ version: "1" })
export class ListMailInboxController {
  constructor(private readonly inbox: MailInboxService) {}

  @Get("/mail/inbox")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the inbox with its suggested labels",
    description:
      "A page of the caller's inbox (docs/plans/email-management phase 5): each message's metadata (never its text), its labels now, the labels the classifier suggested as it arrived (best first, ticked or not, and whether it has each already) and what was decided. `status` is `review` (in the inbox, nothing decided; the default), `unread`, `approved` (since `approvedSince`, a day ago by default, wherever they are now, newest decision first) or `all`; `sortBy` is `receivedTime` (the default), `confidence` (the best ticked suggestion the message lacks), `from` (the sender's name, then address) or `subject`, each `sort` `desc` (the default) or `asc`; approved messages are newest decision first unless sorted otherwise. With the statistics strip's counts.",
    operationId: "ListMailInbox",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "status",
    description: "Which messages",
    enum: MailInboxStatus,
    enumName: "MailInboxStatus",
    enumSchema: { description: "Which of the inbox's messages to list" },
    required: false,
  })
  @ApiQuery({
    name: "accountId",
    description: "Only this mail account's",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "search",
    description: "Only those whose subject, sender or address contains this",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "minConfidence",
    description:
      "Only those with a ticked suggestion to add at least this confident, 0 to 1",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "approvedSince",
    description:
      "Where approved begins, ISO 8601 (the site sends the start of the day)",
    type: String,
    required: false,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description: "A page of the inbox, and its counts.",
    type: ListMailInboxResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query(
      "status",
      new DefaultValuePipe(MailInboxStatus.Review),
      new ParseEnumPipe(MailInboxStatus),
    )
    status: MailInboxStatus,
    @Query("accountId") accountId: string | undefined,
    @Query("search") search: string | undefined,
    @Query("minConfidence", new ParseFloatPipe({ optional: true }))
    minConfidence: number | undefined,
    @Query("approvedSince") approvedSince: string | undefined,
    @Query(
      "sortBy",
      new DefaultValuePipe(MailInboxSort.ReceivedTime),
      new ParseEnumPipe(MailInboxSort),
    )
    sortBy: MailInboxSort,
    @Query("sort", new ParseEnumPipe(SortDirection, { optional: true }))
    sort: SortDirection | undefined,
    @Query("pageSize", new DefaultValuePipe(50), ParseIntPipe)
    pageSize: number,
    @Query("startPage", new DefaultValuePipe(0), ParseIntPipe)
    startPage: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailInboxResponse = await this.inbox.list(user.userId, {
      status,
      accountId,
      search,
      minConfidence,
      approvedSince,
      sortBy,
      ...(sort ? { sort } : {}),
      pageSize,
      startPage,
    });
    response.status(HttpStatus.OK).send(body);
  }
}

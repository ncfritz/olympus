import { ListMailPaymentMatchesResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseBoolPipe,
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  MAX_PAYMENT_PAGE,
  MailPaymentService,
} from "../services/MailPaymentService";

@Controller({ version: "1" })
export class ListMailPaymentMatchesController {
  constructor(private readonly payments: MailPaymentService) {}

  @Get("/mail/payment-matches")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists payment confirmations and the open bills they pay",
    description: `Transitions from payments (docs/plans/email-management phase 7): a message whose subject or snippet reads as a payment made, paired with the newest message before it (within 90 days, from the same sender or domain) in an open state with a transition to a closed one; the pair suggests moving the bill (\`Bills/*Payable\` to \`Bills/*Paid\`), applied as an ApplyMailChanges on the bill. A pair declined with DismissMailPaymentMatches gives way to the bill before. Newest confirmation first, up to ${MAX_PAYMENT_PAGE} a page. Computed on read over the whole mailbox: \`inInbox=true\` keeps it to the inbox's confirmations and is quick.`,
    operationId: "ListMailPaymentMatches",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "accountId",
    description: "Only this mail account's",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "inInbox",
    description: "Only those whose confirmation is in the inbox, or is not",
    type: Boolean,
    required: false,
  })
  @ApiQuery({
    name: "offset",
    description: "How many to pass over",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: `At most this many, up to ${MAX_PAYMENT_PAGE}`,
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "A page of matches, and how many there are.",
    type: ListMailPaymentMatchesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("accountId") accountId: string | undefined,
    @Query("inInbox", new ParseBoolPipe({ optional: true }))
    inInbox: boolean | undefined,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailPaymentMatchesResponse = await this.payments.matches(
      user.userId,
      { accountId, inInbox, offset, limit },
    );
    response.status(HttpStatus.OK).send(body);
  }
}

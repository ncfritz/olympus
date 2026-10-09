import { ListMailOpenBillsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
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
export class ListMailOpenBillsController {
  constructor(private readonly payments: MailPaymentService) {}

  @Get("/mail/open-bills")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the messages in an open state, oldest first",
    description: `The inbox's open payables (docs/plans/email-management phase 7): every message in an open state (\`Bills/*Payable\`), with the closed state its family's transition leads to and its star, oldest first, up to ${MAX_PAYMENT_PAGE} a page; and how many have been open under 30 days, 30 to 90, and longer.`,
    operationId: "ListMailOpenBills",
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
    description: "A page of open bills, and their ages.",
    type: ListMailOpenBillsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("accountId") accountId: string | undefined,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailOpenBillsResponse = await this.payments.openBills(
      user.userId,
      { accountId, offset, limit },
    );
    response.status(HttpStatus.OK).send(body);
  }
}

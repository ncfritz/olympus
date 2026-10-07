import {
  DismissMailPaymentMatchesRequest,
  DismissMailPaymentMatchesResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
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
import {
  MAX_PAYMENT_PAIRS,
  MailPaymentService,
} from "../services/MailPaymentService";

@Controller({ version: "1" })
export class DismissMailPaymentMatchesController {
  constructor(private readonly payments: MailPaymentService) {}

  @Post("/mail/account/:accountId/payment-matches/dismiss")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Declines payment matches",
    description: `Up to ${MAX_PAYMENT_PAIRS} pairs, each a confirmation and a bill by Gmail ID, recorded as not a bill and its payment (docs/plans/email-management phase 7); the confirmation is then matched with the open bill before, if any. A pair naming a message the account does not have is left out. Gmail is not changed.`,
    operationId: "DismissMailPaymentMatches",
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
    type: DismissMailPaymentMatchesRequest,
    required: true,
    description: "Input for the DismissMailPaymentMatches operation",
  })
  @ApiOkResponse({
    description: "The pairs were recorded as declined.",
    type: DismissMailPaymentMatchesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account of the caller's.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: DismissMailPaymentMatchesRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DismissMailPaymentMatchesResponse = {
      dismissed: await this.payments.dismiss(user.userId, accountId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

import {
  AcceptMailPaymentMatchesRequest,
  AcceptMailPaymentMatchesResponse,
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
export class AcceptMailPaymentMatchesController {
  constructor(private readonly payments: MailPaymentService) {}

  @Post("/mail/account/:accountId/payment-matches/accept")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Approves payment matches, moving each bill",
    description: `Up to ${MAX_PAYMENT_PAIRS} pairs, each a payment confirmation and a bill by Gmail ID (docs/plans/email-management phase 7): each bill still matched with its payment moves along its transition (\`Bills/*Payable\` to \`Bills/*Paid\`), all in one change batch written to Gmail and undone from the change log; each match is kept as an example the classifier learns payments from. A pair no longer matched is left out.`,
    operationId: "AcceptMailPaymentMatches",
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
    type: AcceptMailPaymentMatchesRequest,
    required: true,
    description: "Input for the AcceptMailPaymentMatches operation",
  })
  @ApiOkResponse({
    description: "The matches still matched were accepted, and the batch.",
    type: AcceptMailPaymentMatchesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such mail account of the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The mailbox is linked for reading only.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Writes to Gmail are turned off.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: AcceptMailPaymentMatchesRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: AcceptMailPaymentMatchesResponse = await this.payments.accept(
      user.userId,
      accountId,
      request,
    );
    response.status(HttpStatus.OK).send(body);
  }
}

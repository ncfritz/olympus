import {
  RecordMailPaymentScoresRequest,
  RecordMailPaymentScoresResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
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
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  MAX_PAYMENT_SCORES,
  MailPaymentService,
} from "../services/MailPaymentService";

@Controller({ version: "1" })
export class RecordMailPaymentScoresController {
  constructor(private readonly payments: MailPaymentService) {}

  @Put("/mail/account/:accountId/payment-scores")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Records the classifier's payment scores",
    description: `For the mail classifier (docs/plans/email-management phase 7 step 3): up to ${MAX_PAYMENT_SCORES} messages by Gmail ID, each with how likely it is a payment confirmation, 0 to 1. The first batch of a run (\`first\`) drops the account's scores before, so a run replaces them. A message scored 0.8 or more is matched to the bill it pays as one whose wording reads as a payment. A message the account does not have is skipped and counted.`,
    operationId: "RecordMailPaymentScores",
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
    type: RecordMailPaymentScoresRequest,
    required: true,
    description: "Input for the RecordMailPaymentScores operation",
  })
  @ApiOkResponse({
    description: "The scores were stored; some may have been skipped.",
    type: RecordMailPaymentScoresResponse,
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
    @Body() request: RecordMailPaymentScoresRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: RecordMailPaymentScoresResponse =
      await this.payments.recordScores(accountId, request);
    response.status(HttpStatus.OK).send(body);
  }
}

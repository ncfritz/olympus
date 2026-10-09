import { ListMailPaymentExamplesResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailPaymentService } from "../services/MailPaymentService";

@Controller({ version: "1" })
export class ListMailPaymentExamplesController {
  constructor(private readonly payments: MailPaymentService) {}

  @Get("/mail/training/payment-examples")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Lists what the classifier learns payments from",
    description:
      "For the mail classifier (docs/plans/email-management phase 7 step 3): one account's messages by Gmail ID, each a payment (the confirmation of a match approved) or not (one of a match declined, never approved, or a bill: a message in any state, up to the newest 20,000). Gmail IDs only.",
    operationId: "ListMailPaymentExamples",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "accountId",
    description: "The mail account",
    type: String,
    required: true,
  })
  @ApiOkResponse({
    description: "The account's examples.",
    type: ListMailPaymentExamplesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No client certificate, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an agent.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("accountId") accountId: string,
    @Res() response: Response,
  ): Promise<void> {
    const body: ListMailPaymentExamplesResponse = {
      examples: await this.payments.examples(accountId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

import { DescribeMailChangeBatchResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
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
import { MailChangeService } from "../services/MailChangeService";

@Controller({ version: "1" })
export class DescribeMailChangeBatchController {
  constructor(private readonly changes: MailChangeService) {}

  @Get("/mail/change-batch/:batchId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes a batch of label changes to Gmail",
    description:
      "One of the caller's batches (docs/plans/email-management phase 4): where it is, its changes counted by outcome, and a page of its changes by Gmail ID, each with the message's user labels when the batch was asked for and what it adds and removes.",
    operationId: "DescribeMailChangeBatch",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "batchId", description: "The batch", type: String })
  @ApiQuery({
    name: "offset",
    required: false,
    type: Number,
    description: "Changes to skip; 0 by default",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Changes on the page, at most 1,000; 100 by default",
  })
  @ApiOkResponse({
    description: "The batch and a page of its changes.",
    type: DescribeMailChangeBatchResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such batch of the caller's.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("batchId") batchId: string,
    @Query("offset") offset: string | undefined,
    @Query("limit") limit: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeMailChangeBatchResponse = await this.changes.describe(
      user.userId,
      batchId,
      offset === undefined ? 0 : Number(offset),
      limit === undefined ? 100 : Number(limit),
    );
    response.status(HttpStatus.OK).send(body);
  }
}

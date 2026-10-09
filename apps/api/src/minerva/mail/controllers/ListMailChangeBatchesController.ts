import { ListMailChangeBatchesResponse } from "@ncfritz/olympus-model";
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
export class ListMailChangeBatchesController {
  constructor(private readonly changes: MailChangeService) {}

  @Get("/mail/account/:accountId/change-batches")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists a mail account's batches of label changes to Gmail",
    description:
      "The change log (docs/plans/email-management phase 4; ADR 0030): the caller's batches for one mailbox, newest first, each with its changes counted by outcome and, for an apply that was undone, the undo.",
    operationId: "ListMailChangeBatches",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Batches to list, at most 200; 50 by default",
  })
  @ApiOkResponse({
    description: "The batches.",
    type: ListMailChangeBatchesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Query("limit") limit: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailChangeBatchesResponse = {
      batches: await this.changes.list(
        user.userId,
        accountId,
        limit === undefined ? 50 : Number(limit),
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

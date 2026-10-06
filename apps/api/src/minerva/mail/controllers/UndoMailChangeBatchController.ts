import { UndoMailChangeBatchResponse } from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Post, Req, Res } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { MailChangeService } from "../services/MailChangeService";
import { DescribeMailChangeBatchController } from "./DescribeMailChangeBatchController";

@Controller({ version: "1" })
export class UndoMailChangeBatchController {
  constructor(private readonly changes: MailChangeService) {}

  @Post("/mail/change-batch/:batchId/undo")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Undoes a batch of label changes to Gmail",
    description:
      "Reverses what one of the caller's finished applies wrote (docs/plans/email-management phase 4; ADR 0030), as a batch of its own: each message still as the apply left it gets its labels back; one changed in Gmail since is synced again instead. Its decisions are taken back for the messages reversed. A batch is undone once.",
    operationId: "UndoMailChangeBatch",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "batchId", description: "The apply to undo", type: String })
  @ApiCreatedResponse({
    type: UndoMailChangeBatchResponse,
    description: "The undo was recorded and the agent has it.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the undo",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such batch of the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      "Not a finished apply, undone already, wrote nothing, or a label it wrote is gone from Gmail.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "Writes to Gmail are turned off, or the agent is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("batchId") batchId: string,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const batch = await this.changes.undo(user.userId, batchId);
    setLocation(response, httpRequest, DescribeMailChangeBatchController, {
      batchId: batch.id,
    });
    const body: UndoMailChangeBatchResponse = { batch };
    response.status(HttpStatus.CREATED).send(body);
  }
}

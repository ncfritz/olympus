import {
  UpdateMailChangeBatchRequest,
  UpdateMailChangeBatchResponse,
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
import { MailChangeService } from "../services/MailChangeService";

@Controller({ version: "1" })
export class UpdateMailChangeBatchController {
  constructor(private readonly changes: MailChangeService) {}

  @Put("/mail/change-batch/:batchId")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Reports on a batch of label changes being written",
    description:
      "For the mail agent (docs/plans/email-management phase 4): where it has got to with a batch, and each change's outcome since its last report. Done, what it wrote is recorded as decided (for an undo, the decisions it reversed are taken back).",
    operationId: "UpdateMailChangeBatch",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "batchId", description: "The batch", type: String })
  @ApiBody({
    type: UpdateMailChangeBatchRequest,
    required: true,
    description: "Input for the UpdateMailChangeBatch operation",
  })
  @ApiOkResponse({
    description: "The batch, with the report recorded.",
    type: UpdateMailChangeBatchResponse,
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
    description: "No such batch.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The batch has finished.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("batchId") batchId: string,
    @Body() request: UpdateMailChangeBatchRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: UpdateMailChangeBatchResponse = {
      batch: await this.changes.report(batchId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

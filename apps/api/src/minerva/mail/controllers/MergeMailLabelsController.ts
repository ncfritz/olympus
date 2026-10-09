import {
  MergeMailLabelsRequest,
  MergeMailLabelsResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
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
export class MergeMailLabelsController {
  constructor(private readonly changes: MailChangeService) {}

  @Post("/mail/account/:accountId/labels/merge")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Merges one label into another in Gmail",
    description:
      "Moves every message with the label (and with each of its children whose name under the label kept is a label already) to the label kept, renames its other children under the label kept, and deletes the labels emptied once Gmail says they are (docs/plans/email-management phase 4). One batch, written by the mail agent in the background: renames first, then messages, then deletes. It can be undone from the change log. PreviewMailLabelMerge shows the same plan without changing anything.",
    operationId: "MergeMailLabels",
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
    type: MergeMailLabelsRequest,
    required: true,
    description: "Input for the MergeMailLabels operation",
  })
  @ApiCreatedResponse({
    type: MergeMailLabelsResponse,
    description: "The merge was recorded and the agent has it.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the merge's batch",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "The account is not the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      "The mailbox is linked for reading only, or the merge would move more than 50,000 messages.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "Writes to Gmail are turned off, or the agent is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Body() request: MergeMailLabelsRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: MergeMailLabelsResponse = await this.changes.merge(
      user.userId,
      accountId,
      request,
    );
    setLocation(response, httpRequest, DescribeMailChangeBatchController, {
      batchId: body.batch.id,
    });
    response.status(HttpStatus.CREATED).send(body);
  }
}

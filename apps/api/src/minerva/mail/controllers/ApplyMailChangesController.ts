import {
  ApplyMailChangesRequest,
  ApplyMailChangesResponse,
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
export class ApplyMailChangesController {
  constructor(private readonly changes: MailChangeService) {}

  @Post("/mail/account/:accountId/change-batches")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Applies label changes to Gmail",
    description:
      "Records a batch of label changes to one of the caller's mailboxes, each message's user labels as Minerva has them, and hands it to the mail agent, which writes it in the background (docs/plans/email-management phase 4; ADR 0030). A message changed in Gmail since is synced again instead of written. Follow the batch with DescribeMailChangeBatch; once done, the proposals it carried out show as applied.",
    operationId: "ApplyMailChanges",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account to change",
    type: String,
  })
  @ApiBody({
    type: ApplyMailChangesRequest,
    required: true,
    description: "Input for the ApplyMailChanges operation",
  })
  @ApiCreatedResponse({
    type: ApplyMailChangesResponse,
    description: "The batch was recorded and the agent has it.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the batch",
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
    description: "The mailbox is linked for reading only.",
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
    @Body() request: ApplyMailChangesRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const batch = await this.changes.apply(user.userId, accountId, request);
    setLocation(response, httpRequest, DescribeMailChangeBatchController, {
      batchId: batch.id,
    });
    const body: ApplyMailChangesResponse = { batch };
    response.status(HttpStatus.CREATED).send(body);
  }
}

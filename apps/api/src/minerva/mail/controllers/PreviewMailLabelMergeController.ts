import { PreviewMailLabelMergeResponse } from "@ncfritz/olympus-model";
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
export class PreviewMailLabelMergeController {
  constructor(private readonly changes: MailChangeService) {}

  @Get("/mail/account/:accountId/labels/merge-preview")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Previews merging one label into another",
    description:
      "What MergeMailLabels would do (docs/plans/email-management phase 4): the messages moved from the label and from each of its children whose name under the label kept is a label already; the children renamed under the label kept; and the labels deleted once empty. Changes nothing.",
    operationId: "PreviewMailLabelMerge",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "accountId",
    description: "The mail account",
    type: String,
  })
  @ApiQuery({
    name: "from",
    required: true,
    type: String,
    description: "The label merged away, by full name",
  })
  @ApiQuery({
    name: "into",
    required: true,
    type: String,
    description: "The label kept, by full name",
  })
  @ApiOkResponse({
    description: "What the merge would do.",
    type: PreviewMailLabelMergeResponse,
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
    description: "The merge would move more than 50,000 messages.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("accountId") accountId: string,
    @Query("from") from: string | undefined,
    @Query("into") into: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: PreviewMailLabelMergeResponse = {
      preview: await this.changes.previewMerge(
        user.userId,
        accountId,
        from,
        into,
      ),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

import {
  UpdateMailLabelRequest,
  UpdateMailLabelResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
} from "@nestjs/common";
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
import { MailLabelService } from "../services/MailLabelService";

@Controller({ version: "1" })
export class UpdateMailLabelController {
  constructor(private readonly labels: MailLabelService) {}

  @Put("/mail/label/:labelId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Sets a mail label's kind",
    description:
      "Makes one of the caller's labels topical, or retired into another of the same account (picking a retired label applies its target). A label becomes a state by joining a family (CreateMailLabelFamily) and stops being one when the family is deleted.",
    operationId: "UpdateMailLabel",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "labelId",
    description: "The ID of the label",
    type: String,
  })
  @ApiBody({
    type: UpdateMailLabelRequest,
    required: true,
    description: "Input for the UpdateMailLabel operation",
  })
  @ApiOkResponse({
    description: "The label as it now is.",
    type: UpdateMailLabelResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      "The label is a state, its target is retired, or other labels merge into it.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("labelId", ParseUUIDPipe) labelId: string,
    @Body() request: UpdateMailLabelRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: UpdateMailLabelResponse = {
      label: await this.labels.update(user.userId, labelId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

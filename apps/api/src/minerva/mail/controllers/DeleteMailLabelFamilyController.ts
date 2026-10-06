import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
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
export class DeleteMailLabelFamilyController {
  constructor(private readonly labels: MailLabelService) {}

  @Delete("/mail/family/:familyId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes a family of state labels",
    description:
      "Removes one of the caller's label families and its transitions; its states become topical labels again. The labels and their messages are not touched.",
    operationId: "DeleteMailLabelFamily",
    tags: ["Mail"],
  })
  @ApiParam({
    name: "familyId",
    description: "The ID of the family",
    type: String,
  })
  @ApiNoContentResponse({ description: "The family was deleted." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("familyId", ParseUUIDPipe) familyId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.labels.deleteFamily(user.userId, familyId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}

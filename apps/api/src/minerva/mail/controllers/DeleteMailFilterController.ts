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
import { MailFilterService } from "../services/MailFilterService";

@Controller({ version: "1" })
export class DeleteMailFilterController {
  constructor(private readonly filters: MailFilterService) {}

  @Delete("/mail/filter/:filterId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes a Gmail filter made from a proposal",
    description:
      "The mail agent deletes the filter in Gmail (one already gone there is no error), and Minerva forgets it (docs/plans/email-management phase 7). Mail it labelled keeps its labels; the sender may be proposed again.",
    operationId: "DeleteMailFilter",
    tags: ["Mail"],
  })
  @ApiParam({
    name: "filterId",
    description: "The filter",
    type: String,
  })
  @ApiNoContentResponse({ description: "The filter was deleted." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such filter of the caller's.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: "Writes are turned off.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("filterId", ParseUUIDPipe) filterId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.filters.delete(user.userId, filterId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}

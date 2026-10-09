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
import { AvailabilityService } from "../services/AvailabilityService";

@Controller({ version: "1" })
export class DeleteAvailabilityBlockController {
  constructor(private readonly availability: AvailabilityService) {}

  @Delete("/availability-block/:blockId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's availability blocks",
    description:
      "Removes a block; the slots it covered go back to what their meetings say. Another user's block is not found.",
    operationId: "DeleteAvailabilityBlock",
    tags: ["Availability"],
  })
  @ApiParam({
    name: "blockId",
    description: "The ID of the block",
    type: String,
  })
  @ApiNoContentResponse({ description: "The block was deleted." })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("blockId", ParseUUIDPipe) blockId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    await this.availability.deleteBlock(user.userId, blockId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}

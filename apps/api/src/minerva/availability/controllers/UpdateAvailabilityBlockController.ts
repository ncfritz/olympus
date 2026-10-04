import {
  EmptyResponse,
  SingleAvailabilityBlockResponse,
  UpdateAvailabilityBlockRequest,
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
import { AvailabilityService } from "../services/AvailabilityService";

@Controller({ version: "1" })
export class UpdateAvailabilityBlockController {
  constructor(private readonly availability: AvailabilityService) {}

  @Put("/availability-block/:blockId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's availability blocks",
    description:
      "Moves, resizes, relevels or relabels a block; what the request leaves out stays. Another user's block is not found.",
    operationId: "UpdateAvailabilityBlock",
    tags: ["Availability"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "blockId",
    description: "The ID of the block",
    type: String,
  })
  @ApiBody({
    type: UpdateAvailabilityBlockRequest,
    required: true,
    description: "Input for the UpdateAvailabilityBlock operation",
  })
  @ApiOkResponse({
    type: SingleAvailabilityBlockResponse,
    description: "The block with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("blockId", ParseUUIDPipe) blockId: string,
    @Body() request: UpdateAvailabilityBlockRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const changes = request?.block ?? {};
    if (
      changes.startTime === undefined &&
      changes.endTime === undefined &&
      changes.status === undefined &&
      changes.label === undefined
    ) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: SingleAvailabilityBlockResponse = {
      block: await this.availability.updateBlock(user.userId, blockId, changes),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

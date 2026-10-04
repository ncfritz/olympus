import { SingleAvailabilityBlockResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import {
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
export class DescribeAvailabilityBlockController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("/availability-block/:blockId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's availability blocks",
    description:
      "Returns a block of time the caller set, with its level and label. Another user's block is not found.",
    operationId: "DescribeAvailabilityBlock",
    tags: ["Availability"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "blockId",
    description: "The ID of the block",
    type: String,
  })
  @ApiOkResponse({
    type: SingleAvailabilityBlockResponse,
    description: "The block was found.",
  })
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
    const body: SingleAvailabilityBlockResponse = {
      block: await this.availability.describeBlock(user.userId, blockId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

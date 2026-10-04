import { ListAvailabilityBlocksResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
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
import { AvailabilityService } from "../services/AvailabilityService";

@Controller({ version: "1" })
export class ListAvailabilityBlocksController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("/availability-blocks")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's availability blocks in a range",
    description:
      "The caller's blocks overlapping the range, by start. The range is at most 92 days.",
    operationId: "ListAvailabilityBlocks",
    tags: ["Availability"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "start",
    description: "An ISO-8601 timestamp: where the range starts",
    required: true,
    type: String,
  })
  @ApiQuery({
    name: "end",
    description: "An ISO-8601 timestamp: where the range ends",
    required: true,
    type: String,
  })
  @ApiOkResponse({
    type: ListAvailabilityBlocksResponse,
    description: "The caller's blocks in the range.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("start") start: string,
    @Query("end") end: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListAvailabilityBlocksResponse = {
      blocks: await this.availability.listBlocks(user.userId, start, end),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

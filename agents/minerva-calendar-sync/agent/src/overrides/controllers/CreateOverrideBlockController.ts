import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  CreateOverrideBlockRequest,
  CreateOverrideBlockResponse,
} from "../../model/overrideBlocks";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OverrideBlockService } from "../services/OverrideBlockService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateOverrideBlockController {
  constructor(private readonly overrideBlocks: OverrideBlockService) {}

  @Post("/override-blocks")
  @ApiOperation({
    summary: "Creates an override block",
    description:
      "Adds a block of time to the Overrides calendar; its status wins over everything synced during it.",
    operationId: "CreateOverrideBlock",
    tags: ["Override Blocks"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateOverrideBlockRequest,
    required: true,
    description: "The block to create.",
  })
  @ApiCreatedResponse({
    description: "The block was created.",
    type: CreateOverrideBlockResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Body() request: CreateOverrideBlockRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateOverrideBlockResponse = {
      overrideBlock: await this.overrideBlocks.create(request.overrideBlock),
    };
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}

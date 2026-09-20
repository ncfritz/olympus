import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  ListOverrideBlocksQuery,
  ListOverrideBlocksResponse,
} from "../../model/overrideBlocks";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OverrideBlockService } from "../services/OverrideBlockService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListOverrideBlocksController {
  constructor(private readonly overrideBlocks: OverrideBlockService) {}

  @Get("/override-blocks")
  @ApiOperation({
    summary: "Lists override blocks",
    description: "Returns the override blocks that overlap the range.",
    operationId: "ListOverrideBlocks",
    tags: ["Override Blocks"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The blocks were listed.",
    type: ListOverrideBlocksResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: ListOverrideBlocksQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListOverrideBlocksResponse = {
      overrideBlocks: await this.overrideBlocks.list(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}

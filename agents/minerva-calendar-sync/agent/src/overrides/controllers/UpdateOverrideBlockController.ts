import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  UpdateOverrideBlockRequest,
  UpdateOverrideBlockResponse,
} from "../../model/overrideBlocks";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OverrideBlockService } from "../services/OverrideBlockService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UpdateOverrideBlockController {
  constructor(private readonly overrideBlocks: OverrideBlockService) {}

  @Put("/override-block/:overrideBlockId")
  @ApiOperation({
    summary: "Updates an override block",
    description: "Changes the status an override block sets.",
    operationId: "UpdateOverrideBlock",
    tags: ["Override Blocks"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "overrideBlockId",
    description: "The ID of the override block",
    type: String,
  })
  @ApiBody({
    type: UpdateOverrideBlockRequest,
    required: true,
    description: "The changes to the block.",
  })
  @ApiOkResponse({
    description: "The block was updated.",
    type: UpdateOverrideBlockResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("overrideBlockId") overrideBlockId: string,
    @Body() request: UpdateOverrideBlockRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateOverrideBlockResponse = {
      overrideBlock: await this.overrideBlocks.update(
        overrideBlockId,
        request.overrideBlock.status,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}

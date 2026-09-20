import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OverrideBlockService } from "../services/OverrideBlockService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DeleteOverrideBlockController {
  constructor(private readonly overrideBlocks: OverrideBlockService) {}

  @Delete("/override-block/:overrideBlockId")
  @ApiOperation({
    summary: "Deletes an override block",
    description:
      "Removes a block from the Overrides calendar; removing one that doesn't exist also succeeds.",
    operationId: "DeleteOverrideBlock",
    tags: ["Override Blocks"],
  })
  @ApiParam({
    name: "overrideBlockId",
    description: "The ID of the override block",
    type: String,
  })
  @ApiNoContentResponse({ description: "The block is gone." })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
  })
  async handle(
    @Param("overrideBlockId") overrideBlockId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.overrideBlocks.delete(overrideBlockId);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}

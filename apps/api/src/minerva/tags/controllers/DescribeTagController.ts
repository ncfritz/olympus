import { DescribeTagResponse } from "@ncfritz/olympus-model";
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
import { TagService } from "../services/TagService";

@Controller({ version: "1" })
export class DescribeTagController {
  constructor(private readonly tags: TagService) {}

  @Get("/tag/:tagId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the signed-in user's tags",
    description:
      "Returns a single tag of the caller's. Another user's tag is not found.",
    operationId: "DescribeTag",
    tags: ["Tags"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tagId",
    description: "The ID of the tag",
    type: String,
  })
  @ApiOkResponse({
    type: DescribeTagResponse,
    description: "The tag was found.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("tagId", ParseUUIDPipe) tagId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeTagResponse = {
      tag: await this.tags.describe(user.userId, tagId),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

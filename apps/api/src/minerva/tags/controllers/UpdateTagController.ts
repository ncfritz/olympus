import {
  EmptyResponse,
  UpdateTagRequest,
  UpdateTagResponse,
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
import { TagService } from "../services/TagService";

@Controller({ version: "1" })
export class UpdateTagController {
  constructor(private readonly tags: TagService) {}

  @Put("/tag/:tagId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Changes one of the signed-in user's tags",
    description:
      "Renames a tag or changes its colour; the change shows wherever the tag is used. Renaming to a name the caller already has is refused.",
    operationId: "UpdateTag",
    tags: ["Tags"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "tagId",
    description: "The ID of the tag to change",
    type: String,
  })
  @ApiBody({
    type: UpdateTagRequest,
    required: true,
    description: "Input for the UpdateTag operation",
  })
  @ApiOkResponse({
    type: UpdateTagResponse,
    description: "The tag with the changes applied.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The request named nothing to change.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The caller already has a tag with the new name.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("tagId", ParseUUIDPipe) tagId: string,
    @Body() request: UpdateTagRequest,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const tag = await this.tags.update(user.userId, tagId, request?.tag);
    if (!tag) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const body: UpdateTagResponse = { tag };
    response.status(HttpStatus.OK).send(body);
  }
}

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
import { TagService } from "../services/TagService";

@Controller({ version: "1" })
export class DeleteTagController {
  constructor(private readonly tags: TagService) {}

  @Delete("/tag/:tagId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Deletes one of the signed-in user's tags",
    description:
      "Removes a tag from the caller's set, and from everything it was on.",
    operationId: "DeleteTag",
    tags: ["Tags"],
  })
  @ApiParam({
    name: "tagId",
    description: "The ID of the tag to delete",
    type: String,
  })
  @ApiNoContentResponse({ description: "The tag was deleted." })
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
    await this.tags.delete(user.userId, tagId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}

import { ListTagsResponse } from "@ncfritz/olympus-model";
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
import { TagService } from "../services/TagService";

/** The caller's own tags; whose is never a parameter. */
@Controller({ version: "1" })
export class ListTagsController {
  constructor(private readonly tags: TagService) {}

  @Get("/tags")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the signed-in user's tags",
    description:
      "Every tag the caller has, by name. With a prefix, only the tags whose names start with it, whatever their case, for a tag picker.",
    operationId: "ListTags",
    tags: ["Tags"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "prefix",
    required: false,
    type: String,
    description:
      "Only tags whose names start with this text, ignoring case; at most 50 characters",
  })
  @ApiOkResponse({
    type: ListTagsResponse,
    description: "The caller's tags.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("prefix") prefix: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListTagsResponse = {
      tags: await this.tags.list(user.userId, prefix),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

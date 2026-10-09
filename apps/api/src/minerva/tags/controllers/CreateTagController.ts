import { CreateTagRequest, CreateTagResponse } from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { TagService } from "../services/TagService";
import { DescribeTagController } from "./DescribeTagController";

@Controller({ version: "1" })
export class CreateTagController {
  constructor(private readonly tags: TagService) {}

  @Post("/tags")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Creates a tag for the signed-in user",
    description:
      "Adds a tag to the caller's set. A name the caller already has, in any case, is refused.",
    operationId: "CreateTag",
    tags: ["Tags"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateTagRequest,
    required: true,
    description: "Input for the CreateTag operation",
  })
  @ApiCreatedResponse({
    type: CreateTagResponse,
    description: "The tag was created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created tag",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The caller already has a tag with that name.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateTagRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const tag = await this.tags.create(user.userId, request?.tag);
    setLocation(response, httpRequest, DescribeTagController, {
      tagId: tag.id,
    });
    const body: CreateTagResponse = { tag };
    response.status(HttpStatus.CREATED).send(body);
  }
}

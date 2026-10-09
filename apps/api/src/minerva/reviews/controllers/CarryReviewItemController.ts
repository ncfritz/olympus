import {
  CarryReviewItemRequest,
  CarryReviewItemResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
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
import { ReviewItemService } from "../services/ReviewItemService";
import { DescribeReviewItemController } from "./DescribeReviewItemController";

@Controller({ version: "1" })
export class CarryReviewItemController {
  constructor(private readonly reviewItems: ReviewItemService) {}

  @Post("/reviews/item/:itemId/carry")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Carries one of the signed-in user's plan items on",
    description:
      "Marks an open or someday item carried and makes its copy, open, for the period after the carrying review: the next day or the next week, in the item's scope unless another is asked for. The copy counts one more carry. An item is carried once; a done, dropped or carried item is refused.",
    operationId: "CarryReviewItem",
    tags: ["Review Items"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "itemId",
    description: "The ID of the item to carry",
    type: String,
  })
  @ApiBody({
    type: CarryReviewItemRequest,
    required: true,
    description: "Input for the CarryReviewItem operation",
  })
  @ApiCreatedResponse({
    type: CarryReviewItemResponse,
    description: "The item was carried; the body is its copy.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the copy",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The item is done, dropped or already carried.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() request: CarryReviewItemRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const reviewItem = await this.reviewItems.carry(
      user.userId,
      itemId,
      request?.reviewId,
      request?.scope,
    );
    setLocation(response, httpRequest, DescribeReviewItemController, {
      itemId: reviewItem.id,
    });
    const body: CarryReviewItemResponse = { reviewItem };
    response.status(HttpStatus.CREATED).send(body);
  }
}

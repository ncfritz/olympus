import {
  CreateReviewRequest,
  CreateReviewResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
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
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { ReviewService } from "../services/ReviewService";
import { DescribeReviewController } from "./DescribeReviewController";

@Controller({ version: "1" })
export class CreateReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Post("/reviews")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Starts a review for the signed-in user",
    description:
      "Starts a daily review of a day or a weekly review of an ISO week, as a draft at step 1. A period after the current one where the caller is, or one the caller already has a review of, is refused.",
    operationId: "CreateReview",
    tags: ["Reviews"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiHeader({
    name: "x-ncfritz-tz",
    required: false,
    description:
      "The caller's IANA timezone, which decides today's date; Etc/UTC when absent",
  })
  @ApiBody({
    type: CreateReviewRequest,
    required: true,
    description: "Input for the CreateReview operation",
  })
  @ApiCreatedResponse({
    type: CreateReviewResponse,
    description: "The review was started.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the review",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The caller already has a review of that kind and period.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateReviewRequest,
    @HeaderTimezone() tz: string,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const review = await this.reviews.create(user.userId, request?.review, tz);
    setLocation(response, httpRequest, DescribeReviewController, {
      reviewId: review.id,
    });
    const body: CreateReviewResponse = { review };
    response.status(HttpStatus.CREATED).send(body);
  }
}

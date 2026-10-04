import {
  CreateAvailabilityBlockRequest,
  SingleAvailabilityBlockResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request } from "express";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { setLocation } from "../../../utils/location";
import { AvailabilityService } from "../services/AvailabilityService";
import { DescribeAvailabilityBlockController } from "./DescribeAvailabilityBlockController";

@Controller({ version: "1" })
export class CreateAvailabilityBlockController {
  constructor(private readonly availability: AvailabilityService) {}

  @Post("/availability-blocks")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Blocks out time for the signed-in user",
    description:
      "Creates a block of time at a level, which wins over every meeting it overlaps and counts outside the working day too.",
    operationId: "CreateAvailabilityBlock",
    tags: ["Availability"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateAvailabilityBlockRequest,
    required: true,
    description: "Input for the CreateAvailabilityBlock operation",
  })
  @ApiCreatedResponse({
    type: SingleAvailabilityBlockResponse,
    description: "The block was created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created block",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateAvailabilityBlockRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const block = await this.availability.createBlock(
      user.userId,
      request?.block,
    );
    const body: SingleAvailabilityBlockResponse = { block };
    setLocation(response, httpRequest, DescribeAvailabilityBlockController, {
      blockId: block.id,
    });
    response.status(HttpStatus.CREATED).send(body);
  }
}

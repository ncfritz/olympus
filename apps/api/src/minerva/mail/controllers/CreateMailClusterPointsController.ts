import {
  CreateMailClusterPointsRequest,
  CreateMailClusterItemsResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  MAX_CLUSTER_ITEMS,
  MailClusterService,
} from "../services/MailClusterService";

@Controller({ version: "1" })
export class CreateMailClusterPointsController {
  constructor(private readonly clusters: MailClusterService) {}

  @Post("/mail/cluster-run/:runId/points")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Adds map points to a building run",
    description: `For the mail classifier (docs/plans/email-management phase 6): up to ${MAX_CLUSTER_ITEMS} of the map's points, each a message by Gmail ID, its place on a 0 to 1 square and the number of the cluster it is in, if any. A message the account does not have is skipped and counted; a cluster the run does not have is left off the point. Posting a message again moves it.`,
    operationId: "CreateMailClusterPoints",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "runId", description: "The building run", type: String })
  @ApiBody({
    type: CreateMailClusterPointsRequest,
    required: true,
    description: "Input for the CreateMailClusterPoints operation",
  })
  @ApiCreatedResponse({
    description: "The points were stored; some may have been skipped.",
    type: CreateMailClusterItemsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No client certificate, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an agent.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such run.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The run is published.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("runId") runId: string,
    @Body() request: CreateMailClusterPointsRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: CreateMailClusterItemsResponse =
      await this.clusters.createPoints(runId, request);
    response.status(HttpStatus.CREATED).send(body);
  }
}

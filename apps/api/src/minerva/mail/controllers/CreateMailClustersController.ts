import {
  CreateMailClustersRequest,
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
  MAX_CLUSTERS,
  MailClusterService,
} from "../services/MailClusterService";

@Controller({ version: "1" })
export class CreateMailClustersController {
  constructor(private readonly clusters: MailClusterService) {}

  @Post("/mail/cluster-run/:runId/clusters")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Adds clusters to a building run",
    description: `For the mail classifier (docs/plans/email-management phase 6): up to ${MAX_CLUSTERS} clusters, each numbered within the run, with its scope (unlabelled mail, or one label's), name, size, purity, place on the map, top labels and senders (up to 10 each) and what it suggests, if anything. A label's cluster whose label the account no longer has is skipped and counted; a top label it does not have is left out of the counts.`,
    operationId: "CreateMailClusters",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "runId", description: "The building run", type: String })
  @ApiBody({
    type: CreateMailClustersRequest,
    required: true,
    description: "Input for the CreateMailClusters operation",
  })
  @ApiCreatedResponse({
    description: "The clusters were stored; some may have been skipped.",
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
    description: "The run is published, or a cluster number is in it already.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("runId") runId: string,
    @Body() request: CreateMailClustersRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: CreateMailClusterItemsResponse =
      await this.clusters.createClusters(runId, request);
    response.status(HttpStatus.CREATED).send(body);
  }
}

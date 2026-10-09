import {
  CreateMailClusterMembersRequest,
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
export class CreateMailClusterMembersController {
  constructor(private readonly clusters: MailClusterService) {}

  @Post("/mail/cluster-run/:runId/members")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Adds a cluster's messages to a building run",
    description: `For the mail classifier (docs/plans/email-management phase 6): up to ${MAX_CLUSTER_ITEMS} messages of one cluster, by its number and the messages' Gmail IDs. A message the account does not have is skipped and counted; one posted again is left as it is.`,
    operationId: "CreateMailClusterMembers",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "runId", description: "The building run", type: String })
  @ApiBody({
    type: CreateMailClusterMembersRequest,
    required: true,
    description: "Input for the CreateMailClusterMembers operation",
  })
  @ApiCreatedResponse({
    description: "The members were stored; some may have been skipped.",
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
    description: "No such run, or no such cluster in it.",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "The run is published.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("runId") runId: string,
    @Body() request: CreateMailClusterMembersRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: CreateMailClusterItemsResponse =
      await this.clusters.createMembers(runId, request);
    response.status(HttpStatus.CREATED).send(body);
  }
}

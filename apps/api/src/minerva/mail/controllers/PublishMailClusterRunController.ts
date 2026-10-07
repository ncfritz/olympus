import {
  PublishMailClusterRunRequest,
  PublishMailClusterRunResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
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
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailClusterService } from "../services/MailClusterService";

@Controller({ version: "1" })
export class PublishMailClusterRunController {
  constructor(private readonly clusters: MailClusterService) {}

  @Post("/mail/cluster-run/:runId/publish")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Publishes a run of the classifier's clustering",
    description:
      "For the mail classifier (docs/plans/email-management phase 6): the run's clusters and map become the account's, on the Clusters page, and the account's runs before it are dropped, in one transaction.",
    operationId: "PublishMailClusterRun",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({ name: "runId", description: "The building run", type: String })
  @ApiBody({
    type: PublishMailClusterRunRequest,
    required: true,
    description: "Input for the PublishMailClusterRun operation",
  })
  @ApiOkResponse({
    description: "The run, published.",
    type: PublishMailClusterRunResponse,
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
    description: "The run is published already.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("runId") runId: string,
    @Body() request: PublishMailClusterRunRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: PublishMailClusterRunResponse = {
      run: await this.clusters.publish(runId, request),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

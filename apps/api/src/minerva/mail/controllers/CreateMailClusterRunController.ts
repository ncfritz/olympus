import {
  CreateMailClusterRunRequest,
  CreateMailClusterRunResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailClusterService } from "../services/MailClusterService";

@Controller({ version: "1" })
export class CreateMailClusterRunController {
  constructor(private readonly clusters: MailClusterService) {}

  @Post("/mail/cluster-runs")
  @RequiresIdentity()
  @Roles("agent")
  @ApiOperation({
    summary: "Begins a run of the classifier's clustering",
    description:
      "For the mail classifier (docs/plans/email-management phase 6): a run for one account and embedding version, building until it is published. Its clusters, members and map points are posted to it and show nowhere until PublishMailClusterRun.",
    operationId: "CreateMailClusterRun",
    tags: ["Mail"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateMailClusterRunRequest,
    required: true,
    description: "Input for the CreateMailClusterRun operation",
  })
  @ApiCreatedResponse({
    description: "The run was begun.",
    type: CreateMailClusterRunResponse,
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
    description: "No such mail account.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateMailClusterRunRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: CreateMailClusterRunResponse = {
      run: await this.clusters.createRun(request),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}

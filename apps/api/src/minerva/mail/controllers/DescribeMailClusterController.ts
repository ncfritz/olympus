import { DescribeMailClusterResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MailClusterService } from "../services/MailClusterService";

@Controller({ version: "1" })
export class DescribeMailClusterController {
  constructor(private readonly clusters: MailClusterService) {}

  @Get("/mail/cluster/:clusterId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Describes one of the caller's mail clusters",
    description:
      "The Clusters page's side panel (docs/plans/email-management phase 6): the cluster, and its 20 newest messages' metadata (sender, subject, when, labels now). Never message text.",
    operationId: "DescribeMailCluster",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "clusterId", description: "The cluster", type: String })
  @ApiOkResponse({
    description: "The cluster and its newest messages.",
    type: DescribeMailClusterResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "No such cluster of the caller's.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("clusterId") clusterId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: DescribeMailClusterResponse = await this.clusters.describe(
      user.userId,
      clusterId,
    );
    response.status(HttpStatus.OK).send(body);
  }
}

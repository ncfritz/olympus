import { GetMailClusterMapResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
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
export class GetMailClusterMapController {
  constructor(private readonly clusters: MailClusterService) {}

  @Get("/mail/clusters")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets the map of the caller's mail and its clusters",
    description:
      "The Clusters page (docs/plans/email-management phase 6): the newest published clustering of one of the caller's accounts (`accountId`, or the one clustered last), its clusters largest first, each with its label mix, purity, top senders and what it suggests, and the map's points, each coloured by its first user label now. Metadata only; never message text. No run yet is an empty map.",
    operationId: "GetMailClusterMap",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "accountId",
    description: "The mail account; the one clustered last when absent",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "The map, or an empty one before the first run.",
    type: GetMailClusterMapResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("accountId") accountId: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: GetMailClusterMapResponse = await this.clusters.map(
      user.userId,
      accountId,
    );
    response.status(HttpStatus.OK).send(body);
  }
}

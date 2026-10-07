import { ListMailClusterMembersResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import {
  MAX_MEMBER_PAGE,
  MailClusterService,
} from "../services/MailClusterService";

@Controller({ version: "1" })
export class ListMailClusterMembersController {
  constructor(private readonly clusters: MailClusterService) {}

  @Get("/mail/cluster/:clusterId/members")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists a page of a mail cluster's messages",
    description: `For applying a cluster's suggestion (docs/plans/email-management phase 6): a page of up to ${MAX_MEMBER_PAGE} of its messages' Gmail IDs, in a fixed order, and how many it has. The site turns them into a change batch.`,
    operationId: "ListMailClusterMembers",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "clusterId", description: "The cluster", type: String })
  @ApiQuery({
    name: "offset",
    description: "How many to pass over",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: `At most this many, up to ${MAX_MEMBER_PAGE}`,
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "A page of its messages, and the count of all of them.",
    type: ListMailClusterMembersResponse,
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
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query("limit", new DefaultValuePipe(MAX_MEMBER_PAGE), ParseIntPipe)
    limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailClusterMembersResponse = await this.clusters.members(
      user.userId,
      clusterId,
      offset,
      limit,
    );
    response.status(HttpStatus.OK).send(body);
  }
}

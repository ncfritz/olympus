import { ListMailClusterSuggestionsResponse } from "@ncfritz/olympus-model";
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
export class ListMailClusterSuggestionsController {
  constructor(private readonly clusters: MailClusterService) {}

  @Get("/mail/cluster-suggestions")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the caller's clusters that suggest something",
    description:
      "Clusters worth a look (docs/plans/email-management phase 6), from each account's newest published run, largest first: unlabelled mail that wants a label of its own (`new-label`), and groups of a label that mixes kinds of mail (`split`). With `label`, only that label's split groups, for the alert on its review.",
    operationId: "ListMailClusterSuggestions",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "label",
    description: "Only this label's split groups, by full name",
    type: String,
    required: false,
  })
  @ApiOkResponse({
    description: "The clusters that suggest something.",
    type: ListMailClusterSuggestionsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("label") label: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailClusterSuggestionsResponse = {
      clusters: await this.clusters.suggestions(user.userId, label),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

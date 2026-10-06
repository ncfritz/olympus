import { GetMailAuditResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
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
import { MailAuditService } from "../services/MailAuditService";

@Controller({ version: "1" })
export class GetMailAuditController {
  constructor(private readonly audit: MailAuditService) {}

  @Get("/mail/audit")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets the latest audit of the caller's mail",
    description:
      "The Re-classification page's findings (docs/plans/email-management phase 2): the latest run's totals, every user label with the changes proposed into and out of it, merge candidates and threads whose messages disagree, with stars counted now. Before the first run there is no summary and no proposals.",
    operationId: "GetMailAudit",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The audit's findings.",
    type: GetMailAuditResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: GetMailAuditResponse = await this.audit.get(user.userId);
    response.status(HttpStatus.OK).send(body);
  }
}

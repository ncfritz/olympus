import { RunMailAuditResponse } from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Post, Res } from "@nestjs/common";
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
export class RunMailAuditController {
  constructor(private readonly audit: MailAuditService) {}

  @Post("/mail/audit/runs")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Audits the caller's mail",
    description:
      "Runs the audit (docs/plans/email-management phase 2) over each of the caller's mail accounts, replacing its last run: label changes proposed from each sender's habits, threads whose messages disagree, and labels that may be one. Read-only towards Gmail. Takes a few seconds on a large mailbox.",
    operationId: "RunMailAudit",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The new runs, one per account.",
    type: RunMailAuditResponse,
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
    const body: RunMailAuditResponse = await this.audit.run(user.userId);
    response.status(HttpStatus.OK).send(body);
  }
}

import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { GetAuditVerificationResponse } from "../../model/audit";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AuditService } from "../services/AuditService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetAuditVerificationController {
  constructor(private readonly audit: AuditService) {}

  @Get("/audit/verification")
  @ApiOperation({
    summary: "Verifies the audit log",
    description:
      "Walks the audit log from its first event, recomputing every hash, and says whether the chain holds and where it first breaks.",
    operationId: "GetAuditVerification",
    tags: ["Audit"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The verification.",
    type: GetAuditVerificationResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const verification = await this.audit.verify();
    const responseBody: GetAuditVerificationResponse = {
      verification: {
        events: verification.events,
        valid: verification.valid,
        brokenAt: verification.brokenAt?.toString(),
      },
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}

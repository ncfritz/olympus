import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import {
  ListAuditEventsQuery,
  ListAuditEventsResponse,
} from "../../model/audit";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AuditService } from "../services/AuditService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class ListAuditEventsController {
  constructor(private readonly audit: AuditService) {}

  @Get("/audit/events")
  @ApiOperation({
    summary: "Lists audit events",
    description:
      "The audit log, newest first, filtered by kind, principal or subject; page with `before`.",
    operationId: "ListAuditEvents",
    tags: ["Audit"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({ description: "The events.", type: ListAuditEventsResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Query() query: ListAuditEventsQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListAuditEventsResponse = {
      events: await this.audit.listEvents(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}

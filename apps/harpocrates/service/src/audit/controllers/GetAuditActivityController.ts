import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import moment from "moment";
import { AnyPkiRole } from "../../auth/roles";
import {
  GetAuditActivityQuery,
  GetAuditActivityResponse,
} from "../../model/audit";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AuditService } from "../services/AuditService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetAuditActivityController {
  constructor(private readonly audit: AuditService) {}

  @Get("/audit/activity")
  @ApiOperation({
    summary: "The audit log's activity",
    description:
      "Every event of the last days (30 by default, at most 90), oldest first, as the console's graphs draw them: its kind and group, when, who and from where, and whether it is sensitive. Its details are GET /audit/events.",
    operationId: "GetAuditActivity",
    tags: ["Audit"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The activity.",
    type: GetAuditActivityResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Query() query: GetAuditActivityQuery,
    @Res() response: Response,
  ): Promise<void> {
    const now = new Date();
    const { since, points } = await this.audit.activity(query.days ?? 30, now);
    const responseBody: GetAuditActivityResponse = {
      asOf: moment(now),
      since: moment(since),
      points: points.map((point) => ({
        sequence: point.sequence.toString(),
        occurredAt: moment(point.occurredAt),
        kind: point.kind,
        group: point.group,
        surface: point.surface,
        principal: point.principal,
        sensitive: point.sensitive,
      })),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}

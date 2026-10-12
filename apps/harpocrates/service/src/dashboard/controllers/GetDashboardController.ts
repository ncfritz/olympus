import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { AnyPkiRole } from "../../auth/roles";
import { GetDashboardResponse } from "../../model/dashboard";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { toDashboard } from "../converters/DashboardConverter";
import { DashboardService } from "../services/DashboardService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("/dashboard")
  @ApiOperation({
    summary: "The CA at a glance",
    description:
      "The console's dashboard: the certificates counted, those expiring within 90 days that nothing has replaced, what needs a person, each CA's newest list, the last 7 days, and the CA itself. The signer's state is GET /signer/status.",
    operationId: "GetDashboard",
    tags: ["Dashboard"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({ description: "The dashboard.", type: GetDashboardResponse })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetDashboardResponse = {
      dashboard: toDashboard(await this.dashboard.read()),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}

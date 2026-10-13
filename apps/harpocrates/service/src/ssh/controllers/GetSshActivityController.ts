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
import { GetSshActivityQuery, GetSshActivityResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshActivityService } from "../services/SshActivityService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetSshActivityController {
  constructor(private readonly activity: SshActivityService) {}

  @Get("/ssh/activity")
  @ApiOperation({
    summary: "The SSH CAs' activity",
    description:
      "Each SSH CA's certificates counted (valid now, issued in the last days, issued ever, in its KRL now, and when the last expires), and the certificates the console's graphs draw: issued in the last days (30 by default, at most 90), valid now, or revoked in the last year; newest first. Never the certificates themselves.",
    operationId: "GetSshActivity",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The activity.",
    type: GetSshActivityResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [HttpStatus.FORBIDDEN],
  })
  @AnyPkiRole()
  async handle(
    @Query() query: GetSshActivityQuery,
    @Res() response: Response,
  ): Promise<void> {
    const now = new Date();
    const { since, cas, certificates } = await this.activity.activity(
      query.days ?? 30,
      now,
    );
    const responseBody: GetSshActivityResponse = {
      asOf: moment(now),
      since: moment(since),
      cas,
      certificates,
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}

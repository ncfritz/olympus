import { DescribeCalendarEventDeadLettersResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { RequiresIdentity, Roles } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { CalendarEventDeadLetterService } from "../services/CalendarEventDeadLetterService";

@Controller({ version: "1" })
export class DescribeCalendarEventDeadLettersController {
  constructor(private readonly deadLetters: CalendarEventDeadLetterService) {}

  @Get("/calendar-events/dead-letters")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Describes the calendar events waiting in the dead-letter queue",
    description:
      "How many of the calendar sync agent's events could not be written to Minerva (ADR 0028), and the first twenty: each with its action, attempts, why and when.",
    operationId: "DescribeCalendarEventDeadLetters",
    tags: ["Calendar Events"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: DescribeCalendarEventDeadLettersResponse,
    description: "What waits in the dead-letter queue.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "The caller is not an admin.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const body: DescribeCalendarEventDeadLettersResponse = {
      deadLetters: await this.deadLetters.describe(),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

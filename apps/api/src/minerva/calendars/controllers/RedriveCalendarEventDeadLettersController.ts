import { RedriveCalendarEventDeadLettersResponse } from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Post, Res } from "@nestjs/common";
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
export class RedriveCalendarEventDeadLettersController {
  constructor(private readonly deadLetters: CalendarEventDeadLetterService) {}

  @Post("/calendar-events/dead-letters/redrive")
  @RequiresIdentity()
  @Roles("admin")
  @ApiOperation({
    summary: "Puts the dead-lettered calendar events back on the events queue",
    description:
      "Every calendar event waiting in the dead-letter queue when the call starts, at most a thousand, goes back onto the events queue as first published, its attempts counted from nought. One that fails again is dead-lettered again.",
    operationId: "RedriveCalendarEventDeadLetters",
    tags: ["Calendar Events"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: RedriveCalendarEventDeadLettersResponse,
    description: "What the redrive moved.",
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
    const body: RedriveCalendarEventDeadLettersResponse = {
      redrive: await this.deadLetters.redrive(),
    };
    response.status(HttpStatus.OK).send(body);
  }
}

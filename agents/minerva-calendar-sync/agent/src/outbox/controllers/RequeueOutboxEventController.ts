import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { OutboxService } from "../services/OutboxService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class RequeueOutboxEventController {
  constructor(private readonly outbox: OutboxService) {}

  @Post("/outbox-event/:outboxEventId/requeue")
  @ApiOperation({
    summary: "Requeues an outbox event",
    description:
      "Puts a failed outbox event back in line; the dispatcher retries it on its next tick.",
    operationId: "RequeueOutboxEvent",
    tags: ["Outbox"],
  })
  @ApiParam({
    name: "outboxEventId",
    description: "The ID of the failed outbox event",
    type: String,
  })
  @ApiNoContentResponse({ description: "The outbox event was requeued." })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("outboxEventId") outboxEventId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.outbox.requeue(outboxEventId);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}

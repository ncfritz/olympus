import {
  SendNotificationRequest,
  SendNotificationResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationService } from "../services/NotificationService";

@Controller({ version: "1" })
export class SendNotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post("/notifications/publish")
  @ApiOperation({
    summary: "Sends a notification to one or more destinations",
    description:
      "This API employs an optimistic send strategy and will fail open.  Internally, each destination may retry one " +
      "or more times on failure, but any notification destination that reports a permanent failure will NOT be " +
      "retried after the API returns." +
      "" +
      "Notifications sent to the WebSocket destination CAN be persisted for in-app retrieval after initial " +
      "notification.  There are various mechanisms to control the in-app display and notification lifetime.  It " +
      "is recommended that a notification's TTL be set to a reasonable value where applicable." +
      "" +
      "This API will report success or failure for each destination provided in the request.  This does not indicate " +
      "delivery of the notification to the final provider, only whether the notification was successfully enqueued " +
      "for further processing.",
    operationId: "SendNotification",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: SendNotificationRequest,
    required: true,
    description: "Input for the SendNotification operation",
  })
  @ApiAcceptedResponse({
    type: SendNotificationResponse,
    description:
      "The notification was successfully enqueued to all destinations.",
  })
  @ApiResponse({
    type: SendNotificationResponse,
    status: HttpStatus.MULTI_STATUS,
    description:
      "Enqueuing failed for at least one destination; each destination's status is in the body.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: SendNotificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const { delivery, expired, allEnqueued } =
      await this.notifications.send(request);
    const responseBody: SendNotificationResponse = delivery;

    if (expired) {
      response.status(HttpStatus.BAD_REQUEST).send(responseBody);
      return;
    }

    response
      .status(allEnqueued ? HttpStatus.ACCEPTED : HttpStatus.MULTI_STATUS)
      .send(responseBody);
  }
}

import {
  AcknowledgeNotificationRequest,
  AcknowledgeNotificationResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiNotModifiedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationService } from "../services/NotificationService";

@Controller({ version: "1" })
export class AcknowledgeNotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Put("/notification/:notificationId/acknowledge")
  @ApiOperation({
    summary: "Sets a notification's ACK status",
    description:
      "This API will acknowledge or un-acknowledge a notification, based on the user input.  By default when a " +
      "notification is marked as acknowledged, it expires after the requested `ttl` (three days by " +
      "default) and is marked for deletion seven days after that.  The expiration time will remain unchanged in the event that a notification is un-acknowledged before " +
      "the deletion sweep occurs.",
    operationId: "AcknowledgeNotification",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "notificationId",
    description: "The ID of the notification to set acknowledgement for",
    type: String,
  })
  @ApiBody({
    type: AcknowledgeNotificationRequest,
    required: true,
    description: "Input for the SendNotification operation",
  })
  @ApiOkResponse({
    type: AcknowledgeNotificationResponse,
    description:
      "The notification's acknowledge state has been updated successfully.",
  })
  @ApiNotModifiedResponse({
    description:
      "The supplied acknowledged state did not require updating the notification",
    type: AcknowledgeNotificationResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("notificationId") notificationId: string,
    @Body() request: AcknowledgeNotificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const { notification, modified } = await this.notifications.acknowledge(
      notificationId,
      request,
    );

    if (!modified) {
      response.status(HttpStatus.NOT_MODIFIED).json({
        notification: notification,
      });
      return;
    }

    const responseBody: AcknowledgeNotificationResponse = {
      notification: notification,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

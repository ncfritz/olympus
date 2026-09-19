import {
  CreateNotificationRequest,
  CreateNotificationResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationService } from "../services/NotificationService";

@Controller({ version: "1" })
export class CreateNotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post("/notifications")
  @ApiOperation({
    summary: "Creates a persistent notification",
    description:
      "This API is used internally to create a notification in the notification store.",
    operationId: "CreateNotification",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateNotificationRequest,
    required: true,
    description: "Input for the CreateNotification operation",
  })
  @ApiCreatedResponse({
    type: CreateNotificationResponse,
    description: "The notification was created successfully.",
  })
  @ApiConflictResponse({
    description:
      "The supplied `notificationId` or `eventId` conflicted with another notification in the notification store",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateNotificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateNotificationResponse = {
      notification: await this.notifications.create(request.notification),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}

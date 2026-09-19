import { DeleteNotificationResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationService } from "../services/NotificationService";

@Controller({ version: "1" })
export class DeleteNotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Delete("/notification/:notificationId")
  @ApiOperation({
    summary: "Deletes a notification",
    description:
      "This API hard deletes a notification.  This action will directly remove the notification from the notification" +
      "store and is a non-recoverable operation.  If you need to soft delete a notification, it is recommended to " +
      "use the `AcknowledgeNotification` API with a `ttl` value of `0`.",
    operationId: "DeleteNotification",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "notificationId",
    description: "The ID of the notification to delete",
    type: String,
  })
  @ApiOkResponse({
    type: DeleteNotificationResponse,
    description: "The notification has been successfully deleted.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("notificationId") notificationId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DeleteNotificationResponse = {
      notification: await this.notifications.delete(notificationId),
    };

    // We don't send a 204 here as the framework, or Axios strips the response body when a 204 is encountered.
    // Sending a 200 allows the body to be returned on a DELETE, even though the RFC there is a bit unclear on
    // the expected behavior.
    response.status(HttpStatus.OK).send(responseBody);
  }
}

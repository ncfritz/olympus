import {
  NotificationChannel,
  notificationRoutingKey,
  NOTIFICATIONS_EXCHANGE,
  SmtpNotificationEvent,
  SynoChatNotificationEvent,
  WebSocketNotificationEvent,
} from "@ncfritz/olympus-messages";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  AcknowledgeNotificationRequest,
  DeliveryState,
  DeliveryStatus,
  EmailValueField,
  Notification,
  NotificationStatistics,
  PartialNotification,
  SendNotificationRequest,
  SendNotificationResponse,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment, { Moment } from "moment";
import { v4 as uuidv4 } from "uuid";
import {
  buildPaginationExpression,
  PaginationParams,
} from "../../../utils/filterUtil";
import {
  GraphQlNotification,
  toDomainObject,
} from "../converters/NotificationConverter";
import { NotificationsGateway } from "../gateway/NotificationsGateway";
import { NOTIFICATION_SETTING_CHANNELS } from "../queries/notificationSettings";
import { NOTIFICATION_TYPE_PROTOCOLS } from "../queries/notificationTypes";
import { NOTIFICATION, NOTIFICATION_COUNT } from "../queries/notifications";

type GraphQlGetUnreadCountResponse = {
  olympus_notifications_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlDescribeNotificationResponse = {
  olympus_notifications: GraphQlNotification[];
};

type GraphQlUpdateNotificationResponse = {
  update_olympus_notifications_by_pk: GraphQlNotification;
};

type GraphQlDuplicateNotificationsResponse = {
  olympus_notifications_aggregate: {
    aggregate: { count: number };
  };
};

type GraphQlInsertNotificationResponse = {
  insert_olympus_notifications: {
    returning: GraphQlNotification[];
  };
};

type GraphQlGetDefaultGroupResponse = {
  olympus_notification_type: [{ defaultGroupId: string }];
};

type GraphQlDeleteNotificationResponse = {
  delete_olympus_notifications: {
    returning: GraphQlNotification[];
  };
};

type GraphQlNotificationStatistic = {
  acknowledged: boolean;
  count: number;
  group: string;
  level: string;
};

type GraphQlListNotificationsResponse = {
  olympus_notifications: GraphQlNotification[];
  olympus_notification_statistics: GraphQlNotificationStatistic[];
};

type GraphQlListNotificationsInGroupResponse = {
  olympus_notifications: GraphQlNotification[];
  olympus_notifications_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

type GraphQlNotificationSetting = {
  olympus_notification_settings_by_pk: {
    synoChat: boolean;
    synoMail: boolean;
    webSocket: boolean;
    email: boolean;
  };
  olympus_notification_type_by_pk: {
    supportsEmail: boolean;
    supportsSynoChat: boolean;
    supportsSynoMail: boolean;
    supportsWebSocket: boolean;
    synoChatDefault: boolean;
    synoMailDefault: boolean;
    webSocketDefault: boolean;
    emailDefault: boolean;
  };
};

type NotificationHint = {
  webSocket: boolean;
  synoChat: boolean;
  synoMail: boolean;
  email: boolean;
};

/** Result of AcknowledgeNotification: `modified` is false when the state already matched. */
export type AcknowledgedNotification = {
  notification: Notification;
  modified: boolean;
};

/** The recent unread notifications and per-group statistics. */
export type NotificationOverview = {
  notifications: Notification[];
  statistics: Record<string, NotificationStatistics>;
};

/** A page of a group's notifications and the group's total count. */
export type NotificationPage = {
  notifications: Notification[];
  count: number;
};

/**
 * Result of SendNotification. `expired` means nothing was enqueued because the
 * request's expiration time has passed; otherwise `allEnqueued` says whether
 * every requested destination was enqueued successfully.
 */
export type SentNotification = {
  delivery: SendNotificationResponse;
  expired: boolean;
  allEnqueued: boolean;
};

/** Olympus notifications: the notification store and delivery triggers. */
/**
 * Message times are ISO-8601 strings. Request bodies are not transformed
 * (no ValidationPipe), so a "Moment" field may still hold the client's
 * string; pass that through unchanged.
 */
const toIsoString = (value: Moment | string | undefined) =>
  moment.isMoment(value) ? value.toISOString() : value;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /** Stores a notification. @throws ConflictException */
  async create(request: PartialNotification): Promise<Notification> {
    const duplicateQueryRequest = gql`
      query CountDuplicateNotifications(
        $notificationId: uuid!
        $eventId: uuid!
      ) {
        olympus_notifications_aggregate(
          where: {
            _or: {
              eventId: { _eq: $eventId }
              notificationId: { _eq: $notificationId }
            }
          }
        ) {
          ${NOTIFICATION_COUNT}
        }
      }
    `;

    const duplicateQueryResponse =
      await this.graphQLClient.request<GraphQlDuplicateNotificationsResponse>(
        duplicateQueryRequest,
        {
          eventId: request.eventId,
          notificationId: request.notificationId,
        },
      );

    if (
      duplicateQueryResponse.olympus_notifications_aggregate.aggregate.count > 0
    ) {
      throw new ConflictException();
    }

    const insertRequest = gql`
      mutation CreateNotification(
        $deletionTime: timestamptz
        $eventId: uuid!
        $eventTime: timestamptz
        $expirationTime: timestamptz
        $group: String
        $level: String!
        $notificationId: uuid!
        $notificationType: String!
        $payload: String
        $ttl: String
      ) {
        insert_olympus_notifications(
          objects: {
            deletionTime: $deletionTime
            eventId: $eventId
            eventTime: $eventTime
            expirationTime: $expirationTime
            group: $group
            level: $level
            notificationId: $notificationId
            notificationTypeId: $notificationType
            payload: $payload
            ttl: $ttl
          }
        ) {
          returning {
            ${NOTIFICATION}
          }
        }
      }
    `;

    const now = moment.utc();
    let expirationTime: Moment | undefined = undefined;
    let deletionTime: Moment | undefined = undefined;

    if (request.ttl) {
      const ttlDuration = moment.duration(request.ttl);
      expirationTime = now.clone().add(ttlDuration);
      deletionTime = expirationTime.clone().add(7, "days");
    }

    let group = "general";

    if (request.group && request.group.trim() !== "") {
      // There is no check to ensure that the group is valid in the system.  This could be added at the cost of an
      // additional request to the database.  If the group is invalid, we can still persist the notification, it will
      // just be grouped under the "recent" section until acknowledged, when it will effectively be detached from the
      // UI as there is no group to display it under.
      group = request.group;
    } else {
      const groupQuery = gql`
        query GetDefaultGroupForNotificationType($type: String!) {
          olympus_notification_type(where: { id: { _eq: $type } }) {
            defaultGroupId
          }
        }
      `;

      const groupResponse =
        await this.graphQLClient.request<GraphQlGetDefaultGroupResponse>(
          groupQuery,
          {
            type: request.notificationType,
          },
        );

      if (groupResponse.olympus_notification_type.length > 0) {
        group = groupResponse.olympus_notification_type[0].defaultGroupId;
      }
    }

    const insertResponse =
      await this.graphQLClient.request<GraphQlInsertNotificationResponse>(
        insertRequest,
        {
          deletionTime: deletionTime ? deletionTime.toISOString() : undefined,
          eventId: request.eventId,
          eventTime: now.toISOString(),
          expirationTime: expirationTime
            ? expirationTime.toISOString()
            : undefined,
          group: group,
          level: request.level,
          notificationId: request.notificationId,
          notificationType: request.notificationType,
          payload: Buffer.from(
            JSON.stringify(request.payload),
            "utf-8",
          ).toString("base64"),
          ttl: request.ttl,
        },
      );

    const notification = toDomainObject(
      insertResponse.insert_olympus_notifications.returning[0],
    );

    // Push a WebSocket notification to inform the UX that an update is needed.
    await this.sendRefreshMessage(notification);

    return notification;
  }

  /** Hard-deletes a notification. @throws NotFoundException */
  async delete(notificationId: string): Promise<Notification> {
    const deleteRequest = gql`
      mutation DeleteNotification($notificationId: uuid!) {
        delete_olympus_notifications(
          where: { notificationId: { _eq: $notificationId } }
        ) {
          returning {
            ${NOTIFICATION}
          }
        }
      }
    `;

    const deleteResponse =
      await this.graphQLClient.request<GraphQlDeleteNotificationResponse>(
        deleteRequest,
        {
          notificationId: notificationId,
        },
      );

    if (deleteResponse.delete_olympus_notifications.returning.length <= 0) {
      throw new NotFoundException();
    }

    const notification = toDomainObject(
      deleteResponse.delete_olympus_notifications.returning[0],
    );

    // Push a WebSocket notification to inform the UX that an update is needed.
    await this.sendRefreshMessage(notification);

    return notification;
  }

  /**
   * Acknowledges or un-acknowledges a notification, adjusting its expiration
   * and deletion times. @throws NotFoundException
   */
  async acknowledge(
    notificationId: string,
    request: AcknowledgeNotificationRequest,
  ): Promise<AcknowledgedNotification> {
    const queryRequest = gql`
      query GetNotification($notificationId: uuid!) {
        olympus_notifications(
          where: { notificationId: { _eq: $notificationId } }
        ) {
          ${NOTIFICATION}
          group
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeNotificationResponse>(
        queryRequest,
        {
          notificationId: notificationId,
        },
      );

    if (
      queryResponse.olympus_notifications === null ||
      queryResponse.olympus_notifications.length <= 0
    ) {
      throw new NotFoundException();
    }

    const target = toDomainObject(queryResponse.olympus_notifications[0]);

    if (target.acknowledged === request.acknowledged) {
      return { notification: target, modified: false };
    }

    const now = moment.utc();
    let deletionTime: Moment | undefined = undefined;
    let expirationTime: Moment | undefined;

    // If the notification is being acknowledged, set the expiration according to the TTL.  The final deletion time
    // is system enforced at seven days.  If the notification is being un-acknowledged, use the stamped deletionTime
    // to back off the seven-day soft deletion period.
    if (request.acknowledged) {
      expirationTime = now.clone().add(moment.duration(request.ttl ?? "P3D"));
      deletionTime = expirationTime.clone().add(7, "days");
    } else if (target.deletionTime) {
      expirationTime = target.deletionTime.clone().subtract(7, "days");
    } else {
      expirationTime = target.expirationTime;
    }

    const updateRequest = gql`
      mutation UpdateNotification(
        $eventId: uuid!
        $acknowledged: Boolean!
        $expirationTime: timestamptz
        $deletionTime: timestamptz
      ) {
        update_olympus_notifications_by_pk(
          pk_columns: { eventId: $eventId }
          _set: {
            acknowledged: $acknowledged
            deletionTime: $deletionTime
            expirationTime: $expirationTime
          }
        ) {
          ${NOTIFICATION}
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateNotificationResponse>(
        updateRequest,
        {
          eventId: target.eventId,
          acknowledged: request.acknowledged,
          expirationTime: expirationTime
            ? expirationTime.toISOString()
            : undefined,
          deletionTime: deletionTime ? deletionTime.toISOString() : undefined,
        },
      );

    const notification = toDomainObject(
      updateResponse.update_olympus_notifications_by_pk,
    );

    // Push a WebSocket notification to inform the UX that an update is needed.
    await this.sendRefreshMessage(notification);

    return { notification, modified: true };
  }

  /** The `count` most recent unread notifications, and statistics for every group. */
  async list(count: number): Promise<NotificationOverview> {
    // TODO: Filter by username once plumbed in
    const queryRequest = gql`
      query ListNotifications {
        olympus_notifications(
        where: { acknowledged: { _neq: true } }
        order_by: { createdTime: desc }, limit: ${count}) {
          ${NOTIFICATION}
        }
        olympus_notification_statistics {
          acknowledged
          count
          group
          level
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationsResponse>(
        queryRequest,
      );

    const notifications: Notification[] = [];
    const statistics: Record<string, NotificationStatistics> = {};

    queryResponse.olympus_notification_statistics.forEach((statistic) => {
      if (!(statistic.group in statistics)) {
        statistics[statistic.group] = {
          total: 0,
          unread: 0,
          info: 0,
          success: 0,
          warning: 0,
          error: 0,
        };
      }

      statistics[statistic.group].total += statistic.count;
      statistics[statistic.group][
        statistic.level as keyof NotificationStatistics
      ] += statistic.count;

      if (!statistic.acknowledged) {
        statistics[statistic.group].unread += statistic.count;
      }
    });

    queryResponse.olympus_notifications.forEach((entry) => {
      notifications.push(toDomainObject(entry));
    });

    return { notifications, statistics };
  }

  /** A page of the notifications in a group. */
  async listInGroup(
    groupId: string,
    pagination: PaginationParams,
  ): Promise<NotificationPage> {
    const paginationExpression = buildPaginationExpression(pagination);

    // TODO: Filter based on username when this is plumbed in
    const queryRequest = gql`
      query ListNotificationsInGroup($group: String!) {
        olympus_notifications(
          ${paginationExpression}
          where: { group: { _eq: $group } }
        ) {
          ${NOTIFICATION}
        }
        olympus_notifications_aggregate(where: {group: {_eq: $group}}) {
          ${NOTIFICATION_COUNT}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotificationsInGroupResponse>(
        queryRequest,
        { group: groupId },
      );

    const notifications: Notification[] = [];

    queryResponse.olympus_notifications.forEach((entry) => {
      notifications.push(toDomainObject(entry));
    });

    return {
      notifications,
      count: queryResponse.olympus_notifications_aggregate.aggregate.count,
    };
  }

  /** The number of unacknowledged notifications. */
  async getUnreadCount(): Promise<number> {
    // TODO: Filter based on the username
    const queryRequest = gql`
      query GetUnreadCount {
        olympus_notifications_aggregate(
          where: { acknowledged: { _neq: true } }
        ) {
          ${NOTIFICATION_COUNT}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlGetUnreadCountResponse>(
        queryRequest,
      );

    return queryResponse.olympus_notifications_aggregate.aggregate.count;
  }

  /**
   * Enqueues a notification to each requested destination the user has
   * enabled for its type. @throws BadRequestException for an unknown type
   */
  async send(request: SendNotificationRequest): Promise<SentNotification> {
    const notificationId = uuidv4();
    const responseBody: SendNotificationResponse = {
      notificationId: notificationId,
    };

    if (request.expirationTime) {
      const expirationTime = moment(request.expirationTime);

      if (moment.utc().isAfter(expirationTime)) {
        return { delivery: responseBody, expired: true, allEnqueued: false };
      }
    }

    // TODO: Plumb in username when it is available
    const settings = await this.loadNotificationSetting(
      "ncfritz",
      request.type,
    );

    if (!settings) {
      throw new BadRequestException();
    }

    const enqueueTasks: Promise<void>[] = [];

    if (request.webSocketDestination) {
      if (settings.webSocket) {
        enqueueTasks.push(
          this.enqueueWebSocketNotification(
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        this.logger.log(
          `Notification type "${notificationId}" does not support the WebSocket channel or the user has disabled the WebSocket channel for this notification type.`,
        );
      }
    }

    if (request.synoChatDestination) {
      if (settings.synoChat) {
        enqueueTasks.push(
          this.enqueueSynoChatNNotification(
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        this.logger.log(
          `Notification type "${notificationId}" does not support the SynoChat channel or the user has disabled the SynoChat channel for this notification type.`,
        );
      }
    }

    if (request.synoMailDestination) {
      if (settings.synoMail) {
        enqueueTasks.push(
          this.enqueueMailNotification(
            "synomail",
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        this.logger.log(
          `Notification type "${notificationId}" does not support the SynoMail channel or the user has disabled the SynoMail channel for this notification type.`,
        );
      }
    }

    if (request.smtpDestination) {
      if (settings.email) {
        enqueueTasks.push(
          this.enqueueMailNotification(
            "email",
            request,
            notificationId,
            responseBody,
          ),
        );
      } else {
        this.logger.log(
          `Notification type "${notificationId}" does not support the Email channel or the user has disabled the Email channel for this notification type.`,
        );
      }
    }

    await Promise.allSettled(enqueueTasks);

    const deliveries = [
      responseBody.webSocketDestination,
      responseBody.synoChatDestination,
      responseBody.synoMailDestination,
      responseBody.externalMailDestination,
    ].filter((delivery): delivery is DeliveryStatus => delivery !== undefined);
    const anyFailed = deliveries.some(
      (delivery) => delivery.status !== DeliveryState.SUCCESS,
    );

    return { delivery: responseBody, expired: false, allEnqueued: !anyFailed };
  }

  private async sendRefreshMessage(notification: Notification): Promise<void> {
    try {
      this.notificationsGateway.send("notification.refresh", {
        groupId: notification.notificationGroup?.id,
        unreadCount: await this.getUnreadCount(),
      });
    } catch (e) {
      this.logger.warn(
        `Unable to send WS notification for notificationId ${notification.notificationId} delete operation: ${String(e)}`,
      );
    }
  }

  private async enqueueWebSocketNotification(
    request: SendNotificationRequest,
    notificationId: string,
    responseBody: SendNotificationResponse,
  ): Promise<void> {
    if (!request.webSocketDestination) {
      return;
    }

    const eventId = uuidv4();
    const now = moment.utc();
    const deliveryStatus: DeliveryStatus = {
      eventId: eventId,
      status: DeliveryState.UNKNOWN,
    };

    try {
      const message: WebSocketNotificationEvent = {
        eventId: eventId,
        notificationId: notificationId,
        notificationType: request.type,
        expirationTime: toIsoString(request.expirationTime),
        publishTime: now.toISOString(),
        level: request.webSocketDestination.level,
        durable: request.webSocketDestination.durable,
        closable: request.webSocketDestination.closable,
        deleteOnClose: request.webSocketDestination.deleteOnClose,
        visibleDuration: request.webSocketDestination.visibleDuration,
        ghost: request.webSocketDestination.ghost,
        group: request.webSocketDestination.group,
        ttl: request.webSocketDestination.ttl,
        context: request.context ?? {},
      };
      await this.amqpConnection.publish(
        NOTIFICATIONS_EXCHANGE,
        notificationRoutingKey(NotificationChannel.WEBSOCKET),
        message,
      );

      deliveryStatus.status = DeliveryState.SUCCESS;
    } catch (e) {
      deliveryStatus.status = DeliveryState.FAILURE;

      this.logger.error(
        `Failed to enqueue notification ${notificationId} with AMQP exchange ${NOTIFICATIONS_EXCHANGE}`,
        e instanceof Error ? e.stack : String(e),
      );
    } finally {
      responseBody.webSocketDestination = deliveryStatus;
    }
  }

  private async enqueueSynoChatNNotification(
    request: SendNotificationRequest,
    notificationId: string,
    responseBody: SendNotificationResponse,
  ): Promise<void> {
    if (!request.synoChatDestination) {
      return;
    }

    const eventId = uuidv4();
    const deliveryStatus: DeliveryStatus = {
      eventId: eventId,
      status: DeliveryState.UNKNOWN,
    };

    try {
      const message: SynoChatNotificationEvent = {
        eventId: eventId,
        notificationId: notificationId,
        notificationType: request.type,
        publishTime: moment.utc().toISOString(),
        expirationTime: toIsoString(request.expirationTime),
        destinationType: request.synoChatDestination.destinationType,
        destination: request.synoChatDestination.destination,
        users: request.synoChatDestination.users,
        context: request.context ?? {},
      };
      await this.amqpConnection.publish(
        NOTIFICATIONS_EXCHANGE,
        notificationRoutingKey(NotificationChannel.SYNOCHAT),
        message,
      );

      deliveryStatus.status = DeliveryState.SUCCESS;
    } catch (e) {
      deliveryStatus.status = DeliveryState.FAILURE;

      this.logger.error(
        `Failed to enqueue notification ${notificationId} with AMQP exchange ${NOTIFICATIONS_EXCHANGE}`,
        e instanceof Error ? e.stack : String(e),
      );
    } finally {
      responseBody.synoChatDestination = deliveryStatus;
    }
  }

  private async enqueueMailNotification(
    mailType: "synomail" | "email",
    request: SendNotificationRequest,
    notificationId: string,
    responseBody: SendNotificationResponse,
  ): Promise<void> {
    const smtpDestination =
      mailType === "synomail"
        ? request.synoMailDestination
        : request.smtpDestination;

    if (!smtpDestination) {
      return;
    }

    const eventId = uuidv4();
    const deliveryStatus: DeliveryStatus = {
      eventId: eventId,
      status: DeliveryState.UNKNOWN,
    };

    try {
      const message: SmtpNotificationEvent = {
        eventId: eventId,
        notificationId: notificationId,
        notificationType: request.type,
        publishTime: moment.utc().toISOString(),
        expirationTime: toIsoString(request.expirationTime),
        priority: smtpDestination.priority,
        from: smtpDestination.from,
        to: smtpDestination.to.map((item) => (item as EmailValueField).value),
        cc: smtpDestination.cc?.map((item) => (item as EmailValueField).value),
        bcc: smtpDestination.bcc?.map(
          (item) => (item as EmailValueField).value,
        ),
        context: request.context ?? {},
      };
      await this.amqpConnection.publish(
        NOTIFICATIONS_EXCHANGE,
        notificationRoutingKey(
          mailType === "synomail"
            ? NotificationChannel.SYNOMAIL
            : NotificationChannel.EMAIL,
        ),
        message,
      );

      deliveryStatus.status = DeliveryState.SUCCESS;
    } catch (e) {
      deliveryStatus.status = DeliveryState.FAILURE;

      this.logger.error(
        `Failed to enqueue notification ${notificationId} with AMQP exchange ${NOTIFICATIONS_EXCHANGE}`,
        e instanceof Error ? e.stack : String(e),
      );
    } finally {
      if (mailType === "synomail") {
        responseBody.synoMailDestination = deliveryStatus;
      } else {
        responseBody.externalMailDestination = deliveryStatus;
      }
    }
  }

  private async loadNotificationSetting(
    username: string,
    notificationType: string,
  ): Promise<NotificationHint | undefined> {
    const queryRequest = gql`
      query GetNotificationSetting(
        $username: String!
        $notificationTypeId: String!
      ) {
        olympus_notification_settings_by_pk(
          notificationTypeId: $notificationTypeId
          username: $username
        ) {
          ${NOTIFICATION_SETTING_CHANNELS}
        }
        olympus_notification_type_by_pk(id: $notificationTypeId) {
          ${NOTIFICATION_TYPE_PROTOCOLS}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlNotificationSetting>(
        queryRequest,
        {
          username: username,
          notificationTypeId: notificationType,
        },
      );

    if (!queryResponse.olympus_notification_type_by_pk) {
      return undefined;
    }

    return {
      webSocket:
        queryResponse.olympus_notification_type_by_pk.supportsWebSocket &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.webSocket
          : queryResponse.olympus_notification_type_by_pk.webSocketDefault),
      synoChat:
        queryResponse.olympus_notification_type_by_pk.supportsSynoChat &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.synoChat
          : queryResponse.olympus_notification_type_by_pk.synoChatDefault),
      synoMail:
        queryResponse.olympus_notification_type_by_pk.supportsSynoMail &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.synoMail
          : queryResponse.olympus_notification_type_by_pk.synoMailDefault),
      email:
        queryResponse.olympus_notification_type_by_pk.supportsEmail &&
        (queryResponse.olympus_notification_settings_by_pk
          ? queryResponse.olympus_notification_settings_by_pk.email
          : queryResponse.olympus_notification_type_by_pk.emailDefault),
    };
  }
}

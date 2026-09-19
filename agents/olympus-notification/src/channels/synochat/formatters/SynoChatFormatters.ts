import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import type { SynoChatNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { SynoChatPayload } from "../payload";
import { StaticStringSynoChatFormatter } from "./StaticStringSynoChatFormatter";

type SynoChatFormatter = NotificationFormatter<
  SynoChatNotificationEvent<NotificationContext>,
  SynoChatPayload
>;

/** Synology Chat formatters by notification type. */
@Injectable()
export class SynoChatFormatters {
  private readonly byType: Record<string, SynoChatFormatter> = {
    system_test: new StaticStringSynoChatFormatter("This is a test message"),
  };

  formatterFor(notificationType: string): SynoChatFormatter | undefined {
    return this.byType[notificationType];
  }
}

import { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { SMTPHandleBarsFormatter } from "../smtpHandlebarsFormatter";

export class SystemTestSmtpFormatter extends SMTPHandleBarsFormatter<
  NotificationContext,
  NotificationContext
> {
  constructor() {
    super("system_test");
  }

  async buildContext(
    context: NotificationContext,
  ): Promise<NotificationContext> {
    return context;
  }
}

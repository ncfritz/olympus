import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { HandlebarsEmailFormatter } from "./HandlebarsEmailFormatter";

/** system_test: renders the notification's own context. */
export class SystemTestEmailFormatter extends HandlebarsEmailFormatter<
  NotificationContext,
  NotificationContext
> {
  constructor(templatesDir: string) {
    super("system_test", templatesDir);
  }

  async buildContext(
    context: NotificationContext,
  ): Promise<NotificationContext> {
    return context;
  }
}

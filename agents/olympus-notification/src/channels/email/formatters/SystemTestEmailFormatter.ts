import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import type { EmailTemplates } from "../services/EmailTemplates";
import { HandlebarsEmailFormatter } from "./HandlebarsEmailFormatter";

/** system_test: renders the notification's own context. */
export class SystemTestEmailFormatter extends HandlebarsEmailFormatter<
  NotificationContext,
  NotificationContext
> {
  constructor(templates: EmailTemplates) {
    super("system_test", templates);
  }

  async buildContext(
    context: NotificationContext,
  ): Promise<NotificationContext> {
    return context;
  }
}

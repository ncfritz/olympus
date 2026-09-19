import type { NotificationContext } from "@ncfritz/olympus-sdk/olympus";
import { Injectable } from "@nestjs/common";
import { MediaApi } from "../../../api/MediaApi";
import { WorkflowApi } from "../../../api/WorkflowApi";
import type { SmtpNotificationEvent } from "../../../delivery/events";
import type { NotificationFormatter } from "../../../delivery/NotificationFormatter";
import type { SmtpPayload } from "../payload";
import { EmailTemplates } from "../services/EmailTemplates";
import { MetadataWorkflowCompleteEmailFormatter } from "./MetadataWorkflowCompleteEmailFormatter";
import { SystemTestEmailFormatter } from "./SystemTestEmailFormatter";
import { TranscodeWorkflowCompleteEmailFormatter } from "./TranscodeWorkflowCompleteEmailFormatter";

type EmailFormatter = NotificationFormatter<
  SmtpNotificationEvent<NotificationContext>,
  SmtpPayload
>;

/** Email formatters by notification type (shared by every mail channel). */
@Injectable()
export class EmailFormatters {
  private readonly byType: Record<string, EmailFormatter>;

  constructor(
    workflowApi: WorkflowApi,
    mediaApi: MediaApi,
    templates: EmailTemplates,
  ) {
    this.byType = {
      system_test: new SystemTestEmailFormatter(templates),
      dionysus_metadata_workflow_completion:
        new MetadataWorkflowCompleteEmailFormatter(workflowApi, templates),
      dionysus_transcode_complete: new TranscodeWorkflowCompleteEmailFormatter(
        mediaApi,
        templates,
      ),
    };
  }

  formatterFor(notificationType: string): EmailFormatter | undefined {
    return this.byType[notificationType];
  }
}

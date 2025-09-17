import workflowApi from "../../api/workflowApi";
import {
  BaseDestinationEvent,
  WebSocketDestinationEvent,
} from "../../types/destinations";
import {
  DionysusWorkflowContext,
  DionysusWorkflowMessageContext,
} from "../../types/dionysus";
import { WebSocketPayload } from "../../types/payloads";
import { NotificationFormatter } from "../formatter";
import { SMTPHandleBarsFormatter } from "../smtpHandlebarsFormatter";

export class MetadataWorkflowCompleteWebsocketFormatter extends NotificationFormatter<
  BaseDestinationEvent<DionysusWorkflowContext>,
  WebSocketPayload
> {
  async formatNotification(
    notification: WebSocketDestinationEvent<DionysusWorkflowContext>,
  ): Promise<WebSocketPayload> {
    return {
      type: "context",
      value: notification.context,
    };
  }
}

export class MetadataWorkflowCompletionSmtpFormatter extends SMTPHandleBarsFormatter<
  DionysusWorkflowContext,
  DionysusWorkflowMessageContext
> {
  constructor() {
    super("dionysus_metadata_workflow_completion");
  }

  async buildContext(
    context: DionysusWorkflowContext,
  ): Promise<DionysusWorkflowMessageContext> {
    const workflow = await workflowApi.describeWorkflow(context.workflowId);
    const workflowSteps = await workflowApi.listWorkflowSteps(
      context.workflowId,
    );

    return {
      workflow: workflow,
      steps: workflowSteps,
    };
  }
}

import type { WorkflowApi } from "../../../api/WorkflowApi";
import type {
  DionysusWorkflowContext,
  DionysusWorkflowMessageContext,
} from "../../../delivery/contexts/dionysus";
import type { EmailTemplates } from "../services/EmailTemplates";
import { HandlebarsEmailFormatter } from "./HandlebarsEmailFormatter";

/** dionysus_metadata_workflow_completion: the workflow and its steps. */
export class MetadataWorkflowCompleteEmailFormatter extends HandlebarsEmailFormatter<
  DionysusWorkflowContext,
  DionysusWorkflowMessageContext
> {
  constructor(
    private readonly workflowApi: WorkflowApi,
    templates: EmailTemplates,
  ) {
    super("dionysus_metadata_workflow_completion", templates);
  }

  async buildContext(
    context: DionysusWorkflowContext,
  ): Promise<DionysusWorkflowMessageContext> {
    const workflow = await this.workflowApi.describeWorkflow(
      context.workflowId,
    );
    const steps = await this.workflowApi.listWorkflowSteps(context.workflowId);
    return { workflow, steps };
  }
}

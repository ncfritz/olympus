import type { WorkflowApi } from "../../../api/WorkflowApi";
import type {
  DionysusWorkflowContext,
  DionysusWorkflowMessageContext,
} from "../../../delivery/contexts/dionysus";
import { HandlebarsEmailFormatter } from "./HandlebarsEmailFormatter";

/** dionysus_metadata_workflow_completion: the workflow and its steps. */
export class MetadataWorkflowCompleteEmailFormatter extends HandlebarsEmailFormatter<
  DionysusWorkflowContext,
  DionysusWorkflowMessageContext
> {
  constructor(
    private readonly workflowApi: WorkflowApi,
    templatesDir: string,
  ) {
    super("dionysus_metadata_workflow_completion", templatesDir);
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

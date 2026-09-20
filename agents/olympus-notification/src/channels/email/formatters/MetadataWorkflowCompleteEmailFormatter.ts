import type { MetadataWorkflowApi } from "@ncfritz/olympus-client";
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
    private readonly workflowApi: MetadataWorkflowApi,
    templates: EmailTemplates,
  ) {
    super("dionysus_metadata_workflow_completion", templates);
  }

  async buildContext(
    context: DionysusWorkflowContext,
  ): Promise<DionysusWorkflowMessageContext> {
    const workflow = await this.workflowApi.describeMetadataWorkflow(
      context.workflowId,
    );
    const steps = await this.workflowApi.listMetadataWorkflowSteps(
      context.workflowId,
    );
    return { workflow, steps };
  }
}

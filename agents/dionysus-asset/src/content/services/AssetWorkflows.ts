import { Inject, Injectable } from "@nestjs/common";
import { ContentApi } from "../../api/ContentApi";
import { contentConfig } from "../../config/configuration";
import type { ContentConfigType } from "../../config/configuration";
import { AssetWorkflow, type AssetWorkflowProps } from "./AssetWorkflow";
import { ContentReporter } from "./ContentReporter";

/** Opens asset workflows with this process's configuration. */
@Injectable()
export class AssetWorkflows {
  constructor(
    @Inject(contentConfig.KEY) private readonly config: ContentConfigType,
    private readonly contentApi: ContentApi,
    private readonly reporter: ContentReporter,
  ) {}

  open(props: AssetWorkflowProps): AssetWorkflow {
    return new AssetWorkflow(props, {
      config: this.config,
      contentApi: this.contentApi,
      reporter: this.reporter,
    });
  }
}

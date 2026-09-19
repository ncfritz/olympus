import { Inject, Injectable } from "@nestjs/common";
import { mediaConfig } from "../../config/configuration";
import type { MediaConfigType } from "../../config/configuration";
import { Handbrake } from "../../tools/handbrake/Handbrake";
import { MediaReporter } from "./MediaReporter";
import { MediaWorkflow } from "./MediaWorkflow";

/** Opens media workflows with this process's configuration. */
@Injectable()
export class MediaWorkflows {
  constructor(
    @Inject(mediaConfig.KEY) private readonly config: MediaConfigType,
    private readonly reporter: MediaReporter,
    private readonly handbrake: Handbrake,
  ) {}

  /**
   * @param extraPath a sub-directory of the workflow's staging directory
   *   (e.g. `transcode`), for a step's own files
   */
  open(
    workflowId: string,
    mediaExtension: string,
    extraPath?: string,
  ): MediaWorkflow {
    return new MediaWorkflow(workflowId, mediaExtension, extraPath, {
      config: this.config,
      reporter: this.reporter,
      handbrake: this.handbrake,
    });
  }
}

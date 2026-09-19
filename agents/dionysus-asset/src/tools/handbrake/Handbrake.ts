import { Inject, Injectable } from "@nestjs/common";
import { toolsConfig } from "../../config/configuration";
import type { ToolsConfigType } from "../../config/configuration";
import HandbrakeCommand from "./HandbrakeCommand";
import { HandbrakeError, HandbrakeErrorType } from "./HandbrakeError";

/** HandBrakeCLI (HANDBRAKE_PATH). */
@Injectable()
export class Handbrake {
  constructor(
    @Inject(toolsConfig.KEY) private readonly tools: ToolsConfigType,
  ) {}

  /**
   * Runs HandBrakeCLI with `options` (as `--name value` arguments) on the
   * next tick; listen for start, progress, output, error and complete.
   */
  spawn(options: Record<string, unknown> = {}): HandbrakeCommand {
    const handbrake = new HandbrakeCommand({
      ...options,
      HandbrakeCLIPath: this.tools.handbrakePath,
    });

    process.nextTick(function () {
      try {
        handbrake.run();
      } catch (e) {
        handbrake.emitError(
          new HandbrakeError(
            HandbrakeErrorType.VALIDATION,
            e instanceof Error ? e.message : String(e),
          ),
        );
      }
    });

    return handbrake;
  }
}

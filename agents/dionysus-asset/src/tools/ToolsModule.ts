import { Global, Inject, Logger, Module, OnModuleInit } from "@nestjs/common";
import Ffmpeg from "fluent-ffmpeg";
import { toolsConfig } from "../config/configuration";
import type { ToolsConfigType } from "../config/configuration";
import { Handbrake } from "./handbrake/Handbrake";

/** The media tools: FFmpeg (FFMPEG_PATH, FFPROBE_PATH) and HandBrakeCLI. */
@Global()
@Module({
  providers: [Handbrake],
  exports: [Handbrake],
})
export class ToolsModule implements OnModuleInit {
  constructor(
    @Inject(toolsConfig.KEY) private readonly tools: ToolsConfigType,
  ) {}

  onModuleInit(): void {
    Ffmpeg.setFfmpegPath(this.tools.ffmpegPath!);
    Ffmpeg.setFfprobePath(this.tools.ffprobePath!);
    new Logger(ToolsModule.name).log(
      `FFmpeg ${this.tools.ffmpegPath}, HandBrakeCLI ${this.tools.handbrakePath}`,
    );
  }
}

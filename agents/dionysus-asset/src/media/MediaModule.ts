import { DynamicModule, Module, Type } from "@nestjs/common";
import { RabbitModule } from "../infra/RabbitModule";
import { CleanupHandler } from "./handlers/CleanupHandler";
import { ConfigureTranscodeHandler } from "./handlers/ConfigureTranscodeHandler";
import { DeleteWorkflowHandler } from "./handlers/DeleteWorkflowHandler";
import { ExtractMetadataHandler } from "./handlers/ExtractMetadataHandler";
import { TranscodeConfigurationHandler } from "./handlers/TranscodeConfigurationHandler";
import { TranscodeMediaHandler } from "./handlers/TranscodeMediaHandler";
import { VerifyTranscodeConfigurationHandler } from "./handlers/VerifyTranscodeConfigurationHandler";
import { MediaReporter } from "./services/MediaReporter";
import { MediaWorkflows } from "./services/MediaWorkflows";

/** The media workflow handlers, by their DISABLE_ switch. */
export const MEDIA_HANDLERS = {
  DISABLE_DIONYSUS_METADATA_HANDLER: ExtractMetadataHandler,
  DISABLE_DIONYSUS_XCODE_PRE_CONFIGURATION_HANDLER: ConfigureTranscodeHandler,
  DISABLE_DIONYSUS_XCODE_CONFIGURATION_HANDLER: TranscodeConfigurationHandler,
  DISABLE_DIONYSUS_XCODE_HANDLER: TranscodeMediaHandler,
  DISABLE_DIONYSUS_VERIFY_XCODE_HANDLER: VerifyTranscodeConfigurationHandler,
  DISABLE_DIONYSUS_CLEANUP_HANDLER: CleanupHandler,
  DISABLE_DIONYSUS_DELETE_MEDIA_WORKFLOW_HANDLER: DeleteWorkflowHandler,
};

/**
 * Media workflows: from a downloaded original through metadata
 * extraction, transcode configuration and verification to the transcode,
 * library upload and cleanup.
 */
@Module({})
export class MediaModule {
  /** @param handlers the enabled MEDIA_HANDLERS */
  static register(handlers: Type[]): DynamicModule {
    return {
      module: MediaModule,
      imports: [RabbitModule],
      providers: [MediaReporter, MediaWorkflows, ...handlers],
    };
  }
}

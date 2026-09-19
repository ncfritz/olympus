import { Module } from "@nestjs/common";
import { SynoChatFormatters } from "./formatters/SynoChatFormatters";
import { SynoChatHandler } from "./handlers/SynoChatHandler";

/** Notifications sent to Synology Chat (queue notifications.synochat). */
@Module({
  providers: [SynoChatFormatters, SynoChatHandler],
})
export class SynoChatModule {}

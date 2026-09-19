import { Module } from "@nestjs/common";
import { EmailFormatters } from "./formatters/EmailFormatters";
import { GmailHandler } from "./handlers/GmailHandler";
import { SynologyMailHandler } from "./handlers/SynologyMailHandler";

/** Notifications sent as email, internally (Synology) or externally (Gmail). */
@Module({
  providers: [EmailFormatters, GmailHandler, SynologyMailHandler],
})
export class EmailModule {}

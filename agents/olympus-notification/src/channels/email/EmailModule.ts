import { Module } from "@nestjs/common";
import { EmailFormatters } from "./formatters/EmailFormatters";
import { GmailHandler } from "./handlers/GmailHandler";
import { SynologyMailHandler } from "./handlers/SynologyMailHandler";
import { EmailTemplates } from "./services/EmailTemplates";

/** Notifications sent as email, internally (Synology) or externally (Gmail). */
@Module({
  providers: [
    EmailFormatters,
    EmailTemplates,
    GmailHandler,
    SynologyMailHandler,
  ],
})
export class EmailModule {}

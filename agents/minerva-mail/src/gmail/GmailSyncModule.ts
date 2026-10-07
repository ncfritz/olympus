import { OlympusClientModule } from "@ncfritz/olympus-client/nest";
import { Module } from "@nestjs/common";
import { ClassifierClient } from "../classifier/ClassifierClient";
import { olympusConfig, runtimeConfig } from "../config/configuration";
import type {
  OlympusConfigType,
  RuntimeConfigType,
} from "../config/configuration";
import { ServicesOnlyGuard } from "../auth/ServicesOnlyGuard";
import { RabbitModule } from "../infra/RabbitModule";
import { StartGmailWritesController } from "./controllers/StartGmailWritesController";
import { GmailClient } from "./GmailClient";
import { GmailCredentialStore } from "./GmailCredentialStore";
import { GmailMessages } from "./GmailMessages";
import { GmailPoll } from "./GmailPoll";
import { GmailReconcile } from "./GmailReconcile";
import { GmailSuggestInbox } from "./GmailSuggestInbox";
import { GmailWriter } from "./GmailWriter";

/**
 * Keeping linked mailboxes in step with Gmail (docs/plans/email-management
 * phase 1b): Gmail read with the stored credentials, changes published to
 * mail.messages, new mail's text to the classifier, the accounts' labels
 * and sync through the API; and label changes written to Gmail for the API
 * (phase 4). The running agent polls and writes with it (AppModule); the
 * gmail command reconciles, polls once or scores the inbox
 * (GmailCommandModule).
 */
@Module({
  imports: [
    RabbitModule,
    OlympusClientModule.forRootAsync({
      inject: [olympusConfig.KEY, runtimeConfig.KEY],
      useFactory: (olympus: OlympusConfigType, runtime: RuntimeConfigType) => ({
        baseUrl: olympus.baseUrl,
        clientName: runtime.serviceName,
        tls: olympus.tls,
      }),
    }),
  ],
  providers: [
    GmailCredentialStore,
    GmailClient,
    ClassifierClient,
    GmailMessages,
    GmailReconcile,
    GmailPoll,
    GmailWriter,
    GmailSuggestInbox,
    ServicesOnlyGuard,
  ],
  controllers: [StartGmailWritesController],
  exports: [GmailReconcile, GmailPoll, GmailWriter, GmailSuggestInbox],
})
export class GmailSyncModule {}

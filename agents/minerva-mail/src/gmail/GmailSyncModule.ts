import { OlympusClientModule } from "@ncfritz/olympus-client/nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  ALL_CONFIG,
  olympusConfig,
  runtimeConfig,
} from "../config/configuration";
import type {
  OlympusConfigType,
  RuntimeConfigType,
} from "../config/configuration";
import { RabbitModule } from "../infra/RabbitModule";
import { GmailClient } from "./GmailClient";
import { GmailCredentialStore } from "./GmailCredentialStore";
import { GmailReconcile } from "./GmailReconcile";

/**
 * Reconciling a linked mailbox with Gmail, as a command (src/gmail.ts):
 * Gmail read with the stored credential, changes published to
 * mail.messages, the account's labels and sync through the API.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: ALL_CONFIG }),
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
  providers: [GmailCredentialStore, GmailClient, GmailReconcile],
})
export class GmailSyncModule {}

import { MetricsModule } from "@ncfritz/olympus-nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ALL_CONFIG, runtimeConfig } from "./config/configuration";
import type { RuntimeConfigType } from "./config/configuration";
import { GmailModule } from "./gmail/GmailModule";
import { GmailPoller } from "./gmail/GmailPoller";
import { GmailSyncModule } from "./gmail/GmailSyncModule";

/**
 * The running agent (docs/plans/email-management): configuration,
 * /metrics, and from phase 1b its management API for the Olympus API on
 * the services listener (linking mailboxes to Gmail) and the history
 * polling that keeps linked mailboxes in step. The Takeout and Gmail
 * commands have modules of their own (takeout.ts, gmail.ts).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); each validates the
      // environment when first injected. main.ts validates it up front.
      load: ALL_CONFIG,
    }),
    // /metrics (ADR 0017)
    MetricsModule.forRootAsync({
      inject: [runtimeConfig.KEY],
      useFactory: (runtime: RuntimeConfigType) => ({
        app: runtime.appName,
        environment: runtime.nodeEnv,
      }),
    }),
    GmailModule,
    GmailSyncModule,
  ],
  providers: [GmailPoller],
})
export class AppModule {}

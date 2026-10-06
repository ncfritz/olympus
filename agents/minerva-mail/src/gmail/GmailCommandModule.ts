import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ALL_CONFIG } from "../config/configuration";
import { GmailSyncModule } from "./GmailSyncModule";

/** The gmail command's context (src/gmail.ts): configuration and sync. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: ALL_CONFIG }),
    GmailSyncModule,
  ],
})
export class GmailCommandModule {}

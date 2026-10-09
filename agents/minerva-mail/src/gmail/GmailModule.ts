import { Module } from "@nestjs/common";
import { ServicesOnlyGuard } from "../auth/ServicesOnlyGuard";
import { CompleteGmailSignInController } from "./controllers/CompleteGmailSignInController";
import { DeleteGmailAccountController } from "./controllers/DeleteGmailAccountController";
import { ListGmailAccountsController } from "./controllers/ListGmailAccountsController";
import { StartGmailSignInController } from "./controllers/StartGmailSignInController";
import { GmailAuth } from "./GmailAuth";
import { GmailCredentialStore } from "./GmailCredentialStore";

/**
 * Gmail (docs/plans/email-management phase 1b): linking a mailbox by the
 * API's consent flow, and the credentials it leaves.
 */
@Module({
  providers: [GmailAuth, GmailCredentialStore, ServicesOnlyGuard],
  controllers: [
    StartGmailSignInController,
    CompleteGmailSignInController,
    ListGmailAccountsController,
    DeleteGmailAccountController,
  ],
  exports: [GmailAuth, GmailCredentialStore],
})
export class GmailModule {}

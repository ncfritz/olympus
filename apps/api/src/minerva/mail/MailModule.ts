import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { RabbitModule } from "../../infra/RabbitModule";
import { ExportMailAuditChangesController } from "./controllers/ExportMailAuditChangesController";
import { GetMailAuditController } from "./controllers/GetMailAuditController";
import { GetMailStatisticsController } from "./controllers/GetMailStatisticsController";
import { ImportMailAccountController } from "./controllers/ImportMailAccountController";
import { ListMailAuditChangesController } from "./controllers/ListMailAuditChangesController";
import { RunMailAuditController } from "./controllers/RunMailAuditController";
import { MailMessageHandler } from "./handlers/MailMessageHandler";
import { MailAccountService } from "./services/MailAccountService";
import { MailAuditService } from "./services/MailAuditService";
import { MailMessageQueues } from "./services/MailMessageQueues";
import { MailMessageService } from "./services/MailMessageService";
import { MailStatisticsService } from "./services/MailStatisticsService";

/**
 * Mail: each user's Gmail labels, message metadata, label suggestions and
 * reviewed changes (ADR 0030, docs/plans/email-management/README.md): the
 * agent's account import, the consumer of its message metadata, and the
 * statistics and audit over it so far.
 */
@Module({
  imports: [GraphQLClientModule, RabbitModule],
  providers: [
    MailAccountService,
    MailAuditService,
    MailMessageService,
    MailMessageQueues,
    MailMessageHandler,
    MailStatisticsService,
  ],
  controllers: [
    ExportMailAuditChangesController,
    GetMailAuditController,
    GetMailStatisticsController,
    ImportMailAccountController,
    ListMailAuditChangesController,
    RunMailAuditController,
  ],
})
export class MailModule {}

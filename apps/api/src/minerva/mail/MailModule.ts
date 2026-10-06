import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { RabbitModule } from "../../infra/RabbitModule";
import { CreateMailLabelFamilyController } from "./controllers/CreateMailLabelFamilyController";
import { DeleteMailLabelFamilyController } from "./controllers/DeleteMailLabelFamilyController";
import { ExportMailAuditChangesController } from "./controllers/ExportMailAuditChangesController";
import { GetMailAuditController } from "./controllers/GetMailAuditController";
import { GetMailStatisticsController } from "./controllers/GetMailStatisticsController";
import { ImportMailAccountController } from "./controllers/ImportMailAccountController";
import { ListMailAuditChangesController } from "./controllers/ListMailAuditChangesController";
import { ListMailLabelFamiliesController } from "./controllers/ListMailLabelFamiliesController";
import { ListMailLabelsController } from "./controllers/ListMailLabelsController";
import { ListMailTrainingAccountsController } from "./controllers/ListMailTrainingAccountsController";
import { ListMailTrainingExamplesController } from "./controllers/ListMailTrainingExamplesController";
import { ListMailTrainingLabelsController } from "./controllers/ListMailTrainingLabelsController";
import { RunMailAuditController } from "./controllers/RunMailAuditController";
import { UpdateMailLabelController } from "./controllers/UpdateMailLabelController";
import { MailMessageHandler } from "./handlers/MailMessageHandler";
import { MailAccountService } from "./services/MailAccountService";
import { MailAuditService } from "./services/MailAuditService";
import { MailLabelService } from "./services/MailLabelService";
import { MailMessageQueues } from "./services/MailMessageQueues";
import { MailMessageService } from "./services/MailMessageService";
import { MailStatisticsService } from "./services/MailStatisticsService";
import { MailTrainingService } from "./services/MailTrainingService";

/**
 * Mail: each user's Gmail labels, message metadata, label suggestions and
 * reviewed changes (ADR 0030, docs/plans/email-management/README.md): the
 * agent's account import, the consumer of its message metadata, and the
 * statistics and audit over it, label kinds, and the classifier's
 * training data.
 */
@Module({
  imports: [GraphQLClientModule, RabbitModule],
  providers: [
    MailAccountService,
    MailAuditService,
    MailLabelService,
    MailMessageService,
    MailMessageQueues,
    MailMessageHandler,
    MailStatisticsService,
    MailTrainingService,
  ],
  controllers: [
    CreateMailLabelFamilyController,
    DeleteMailLabelFamilyController,
    ExportMailAuditChangesController,
    GetMailAuditController,
    GetMailStatisticsController,
    ImportMailAccountController,
    ListMailAuditChangesController,
    ListMailLabelFamiliesController,
    ListMailLabelsController,
    ListMailTrainingAccountsController,
    ListMailTrainingExamplesController,
    ListMailTrainingLabelsController,
    RunMailAuditController,
    UpdateMailLabelController,
  ],
})
export class MailModule {}

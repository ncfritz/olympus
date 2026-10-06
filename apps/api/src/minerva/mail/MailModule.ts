import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { RabbitModule } from "../../infra/RabbitModule";
import { CompleteMailAccountConnectController } from "./controllers/CompleteMailAccountConnectController";
import { ConnectMailAccountController } from "./controllers/ConnectMailAccountController";
import { CreateMailLabelFamilyController } from "./controllers/CreateMailLabelFamilyController";
import { CreateMailSuggestionRunController } from "./controllers/CreateMailSuggestionRunController";
import { CreateMailSuggestionsController } from "./controllers/CreateMailSuggestionsController";
import { DeleteMailLabelFamilyController } from "./controllers/DeleteMailLabelFamilyController";
import { ExportMailAuditChangesController } from "./controllers/ExportMailAuditChangesController";
import { GetMailAuditController } from "./controllers/GetMailAuditController";
import { GetMailStatisticsController } from "./controllers/GetMailStatisticsController";
import { ImportMailAccountController } from "./controllers/ImportMailAccountController";
import { ListMailAccountsController } from "./controllers/ListMailAccountsController";
import { ListMailAuditChangesController } from "./controllers/ListMailAuditChangesController";
import { ListMailLabelFamiliesController } from "./controllers/ListMailLabelFamiliesController";
import { ListMailLabelsController } from "./controllers/ListMailLabelsController";
import { ListMailTrainingAccountsController } from "./controllers/ListMailTrainingAccountsController";
import { ListMailTrainingExamplesController } from "./controllers/ListMailTrainingExamplesController";
import { ListMailTrainingLabelsController } from "./controllers/ListMailTrainingLabelsController";
import { PublishMailSuggestionRunController } from "./controllers/PublishMailSuggestionRunController";
import { RunMailAuditController } from "./controllers/RunMailAuditController";
import { UpdateMailLabelController } from "./controllers/UpdateMailLabelController";
import { MailMessageHandler } from "./handlers/MailMessageHandler";
import { MailAccountService } from "./services/MailAccountService";
import { MailAuditService } from "./services/MailAuditService";
import { MailLabelService } from "./services/MailLabelService";
import { MailLinkService } from "./services/MailLinkService";
import { MailMessageQueues } from "./services/MailMessageQueues";
import { MailMessageService } from "./services/MailMessageService";
import { MailStatisticsService } from "./services/MailStatisticsService";
import { MailSuggestionService } from "./services/MailSuggestionService";
import { MailTrainingService } from "./services/MailTrainingService";
import { MinervaMailAgentClient } from "./services/MinervaMailAgentClient";

/**
 * Mail: each user's Gmail labels, message metadata, label suggestions and
 * reviewed changes (ADR 0030, docs/plans/email-management/README.md): the
 * agent's account import, the consumer of its message metadata, and the
 * statistics and audit over it, label kinds, and the classifier's
 * training data and suggestions, and linking mailboxes to Gmail.
 */
@Module({
  imports: [GraphQLClientModule, RabbitModule],
  providers: [
    MailAccountService,
    MailAuditService,
    MailLabelService,
    MailLinkService,
    MailMessageService,
    MailMessageQueues,
    MailMessageHandler,
    MailStatisticsService,
    MailSuggestionService,
    MailTrainingService,
    MinervaMailAgentClient,
  ],
  controllers: [
    // The static callback before ImportMailAccount's sibling routes.
    CompleteMailAccountConnectController,
    ConnectMailAccountController,
    CreateMailLabelFamilyController,
    CreateMailSuggestionRunController,
    CreateMailSuggestionsController,
    DeleteMailLabelFamilyController,
    ExportMailAuditChangesController,
    GetMailAuditController,
    GetMailStatisticsController,
    ImportMailAccountController,
    ListMailAccountsController,
    ListMailAuditChangesController,
    ListMailLabelFamiliesController,
    ListMailLabelsController,
    ListMailTrainingAccountsController,
    ListMailTrainingExamplesController,
    ListMailTrainingLabelsController,
    PublishMailSuggestionRunController,
    RunMailAuditController,
    UpdateMailLabelController,
  ],
})
export class MailModule {}

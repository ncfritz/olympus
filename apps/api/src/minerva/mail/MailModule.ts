import { ApplyMailChangesController } from "./controllers/ApplyMailChangesController";
import { DescribeMailChangeBatchController } from "./controllers/DescribeMailChangeBatchController";
import { DismissMailProposalsController } from "./controllers/DismissMailProposalsController";
import { ListMailChangeBatchesController } from "./controllers/ListMailChangeBatchesController";
import { UndoMailChangeBatchController } from "./controllers/UndoMailChangeBatchController";
import { UpdateMailChangeBatchController } from "./controllers/UpdateMailChangeBatchController";
import { MailChangeService } from "./services/MailChangeService";
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
import { ListMailMessageStatesController } from "./controllers/ListMailMessageStatesController";
import { ListMailAuditChangesController } from "./controllers/ListMailAuditChangesController";
import { ListMailLabelFamiliesController } from "./controllers/ListMailLabelFamiliesController";
import { ListMailLabelsController } from "./controllers/ListMailLabelsController";
import { ListMailSyncAccountsController } from "./controllers/ListMailSyncAccountsController";
import { ListMailTrainingAccountsController } from "./controllers/ListMailTrainingAccountsController";
import { ListMailTrainingExamplesController } from "./controllers/ListMailTrainingExamplesController";
import { ListMailTrainingLabelsController } from "./controllers/ListMailTrainingLabelsController";
import { PublishMailSuggestionRunController } from "./controllers/PublishMailSuggestionRunController";
import { SyncMailLabelsController } from "./controllers/SyncMailLabelsController";
import { UpdateMailAccountSyncController } from "./controllers/UpdateMailAccountSyncController";
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
import { MailSyncService } from "./services/MailSyncService";
import { MailTrainingService } from "./services/MailTrainingService";
import { MinervaMailAgentClient } from "./services/MinervaMailAgentClient";

/**
 * Mail: each user's Gmail labels, message metadata, label suggestions and
 * reviewed changes (ADR 0030, docs/plans/email-management/README.md): the
 * agent's account import, the consumer of its message metadata, and the
 * statistics and audit over it, label kinds, and the classifier's
 * training data and suggestions, and linking mailboxes to Gmail and
 * keeping them in step with it.
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
    MailSyncService,
    MailChangeService,
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
    ListMailMessageStatesController,
    ApplyMailChangesController,
    DescribeMailChangeBatchController,
    DismissMailProposalsController,
    ListMailChangeBatchesController,
    UndoMailChangeBatchController,
    UpdateMailChangeBatchController,
    ListMailAuditChangesController,
    ListMailLabelFamiliesController,
    ListMailLabelsController,
    ListMailSyncAccountsController,
    ListMailTrainingAccountsController,
    ListMailTrainingExamplesController,
    ListMailTrainingLabelsController,
    PublishMailSuggestionRunController,
    RunMailAuditController,
    SyncMailLabelsController,
    UpdateMailAccountSyncController,
    UpdateMailLabelController,
  ],
})
export class MailModule {}

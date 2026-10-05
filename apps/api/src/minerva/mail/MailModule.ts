import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { RabbitModule } from "../../infra/RabbitModule";
import { ImportMailAccountController } from "./controllers/ImportMailAccountController";
import { MailMessageHandler } from "./handlers/MailMessageHandler";
import { MailAccountService } from "./services/MailAccountService";
import { MailMessageQueues } from "./services/MailMessageQueues";
import { MailMessageService } from "./services/MailMessageService";

/**
 * Mail: each user's Gmail labels, message metadata, label suggestions and
 * reviewed changes (ADR 0030, docs/plans/email-management/README.md): the
 * agent's account import and the consumer of its message metadata so far.
 */
@Module({
  imports: [GraphQLClientModule, RabbitModule],
  providers: [
    MailAccountService,
    MailMessageService,
    MailMessageQueues,
    MailMessageHandler,
  ],
  controllers: [ImportMailAccountController],
})
export class MailModule {}

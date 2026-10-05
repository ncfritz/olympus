import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { ImportMailAccountController } from "./controllers/ImportMailAccountController";
import { MailAccountService } from "./services/MailAccountService";

/**
 * Mail: each user's Gmail labels, message metadata, label suggestions and
 * reviewed changes (ADR 0030, docs/plans/email-management/README.md). The
 * operations arrive phase by phase.
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [MailAccountService],
  controllers: [ImportMailAccountController],
})
export class MailModule {}

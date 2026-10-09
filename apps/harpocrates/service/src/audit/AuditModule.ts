import { Global, Module } from "@nestjs/common";
import { GetAuditVerificationController } from "./controllers/GetAuditVerificationController";
import { ListAuditEventsController } from "./controllers/ListAuditEventsController";
import { AuditService } from "./services/AuditService";

/** The append-only, hash-chained audit log (ADR 0020, Audit). */
@Global()
@Module({
  controllers: [ListAuditEventsController, GetAuditVerificationController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

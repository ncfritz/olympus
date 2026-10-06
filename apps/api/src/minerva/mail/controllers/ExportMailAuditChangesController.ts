import { MailAuditAction } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  ParseEnumPipe,
  ParseFloatPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  MAIL_AUDIT_EXPORT_COLUMNS,
  MailAuditService,
} from "../services/MailAuditService";

/** The file name for an export, with the label if there is one. */
export const exportFileName = (label?: string) =>
  label
    ? `mail-audit-changes-${
        label
          .replace(/[^A-Za-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "label"
      }.csv`
    : "mail-audit-changes.csv";

@Controller({ version: "1" })
export class ExportMailAuditChangesController {
  constructor(private readonly audit: MailAuditService) {}

  @Get("/mail/audit/changes/export")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Exports the latest audit's proposed label changes as CSV",
    description: `The change plan for review outside the site (docs/plans/email-management phase 2): every label change the latest audit proposes over the caller's mail, or those for one label, one action or at least a confidence, a row each, most confident first. Columns: ${MAIL_AUDIT_EXPORT_COLUMNS.join(", ")}. Metadata only; never message text.`,
    operationId: "ExportMailAuditChanges",
    tags: ["Mail"],
  })
  @ApiProduces("text/csv")
  @ApiQuery({
    name: "label",
    description: "Only changes adding or removing this label, by full name",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "action",
    description: "Only additions or only removals",
    enum: MailAuditAction,
    enumName: "MailAuditAction",
    enumSchema: { description: "What a proposed label change does" },
    required: false,
  })
  @ApiQuery({
    name: "minConfidence",
    description: "Only changes at least this confident, 0 to 1",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "The changes as CSV, as an attachment.",
    schema: { type: "string" },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("label") label: string | undefined,
    @Query("action", new ParseEnumPipe(MailAuditAction, { optional: true }))
    action: MailAuditAction | undefined,
    @Query("minConfidence", new ParseFloatPipe({ optional: true }))
    minConfidence: number | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const csv = await this.audit.exportChanges(user.userId, {
      label,
      action,
      minConfidence,
    });
    response
      .status(HttpStatus.OK)
      .type("text/csv; charset=utf-8")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="${exportFileName(label)}"`,
      )
      .send(csv);
  }
}

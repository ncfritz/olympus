import {
  ListMailAuditChangesResponse,
  MailAuditAction,
  MailAuditRule,
  MailAuditChangeSort,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseEnumPipe,
  ParseFloatPipe,
  ParseIntPipe,
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
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";
import { MailAuditService } from "../services/MailAuditService";

@Controller({ version: "1" })
export class ListMailAuditChangesController {
  constructor(private readonly audit: MailAuditService) {}

  @Get("/mail/audit/changes")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists the latest audit's proposed label changes",
    description:
      "A page of the label changes proposed over the caller's mail, by the latest audit and by the classifier's latest published suggestions, each with its message's metadata (never its text) and the evidence behind it (the sender's counts, or whether the classifier's is ticked), optionally for one label, one action, one rule, or at least a confidence. `sortBy` is `confidence` (the default) or `receivedTime`.",
    operationId: "ListMailAuditChanges",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
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
    name: "rule",
    description:
      "Only those one rule proposed: the sender audit, or the classifier",
    enum: MailAuditRule,
    enumName: "MailAuditRule",
    enumSchema: {
      description: "What proposed a change: an audit rule, or the classifier",
    },
    required: false,
  })
  @ApiQuery({
    name: "minConfidence",
    description: "Only changes at least this confident, 0 to 1",
    type: Number,
    required: false,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description: "A page of proposed changes.",
    type: ListMailAuditChangesResponse,
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
    @Query("rule", new ParseEnumPipe(MailAuditRule, { optional: true }))
    rule: MailAuditRule | undefined,
    @Query("minConfidence", new ParseFloatPipe({ optional: true }))
    minConfidence: number | undefined,
    @Query(
      "sortBy",
      new DefaultValuePipe(MailAuditChangeSort.Confidence),
      new ParseEnumPipe(MailAuditChangeSort),
    )
    sortBy: MailAuditChangeSort,
    @Query(
      "sort",
      new DefaultValuePipe(SortDirection.DESC),
      new ParseEnumPipe(SortDirection),
    )
    sort: SortDirection,
    @Query("pageSize", new DefaultValuePipe(50), ParseIntPipe)
    pageSize: number,
    @Query("startPage", new DefaultValuePipe(0), ParseIntPipe)
    startPage: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailAuditChangesResponse = await this.audit.listChanges(
      user.userId,
      {
        label,
        action,
        rule,
        minConfidence,
        sortBy,
        sort,
        pageSize,
        startPage,
      },
    );
    response.status(HttpStatus.OK).send(body);
  }
}

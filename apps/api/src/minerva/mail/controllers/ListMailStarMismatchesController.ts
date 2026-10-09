import {
  ListMailStarMismatchesResponse,
  MailStarFix,
} from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseEnumPipe,
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
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MAX_STAR_PAGE, MailStarService } from "../services/MailStarService";

@Controller({ version: "1" })
export class ListMailStarMismatchesController {
  constructor(private readonly stars: MailStarService) {}

  @Get("/mail/star-mismatches")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists messages whose state and star disagree",
    description: `Stars as states (docs/plans/email-management phase 7): a message in an open state (\`Bills/*Payable\`) that is not starred, or starred with another icon than the account's attention star, and one in a closed state still carrying the attention star. Each with its fix: \`star\` (written to Gmail by an ApplyMailChanges adding STARRED), or an icon to set in Gmail by hand (\`attention-icon\`, \`done-icon\`; the API writes no icon), which the next sync records. Newest first, up to ${MAX_STAR_PAGE} a page, with each fix's count. Metadata only.`,
    operationId: "ListMailStarMismatches",
    tags: ["Mail"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "accountId",
    description: "Only this mail account's",
    type: String,
    required: false,
  })
  @ApiQuery({
    name: "fix",
    description: "Only those wanting this fix",
    enum: MailStarFix,
    enumName: "MailStarFix",
    enumSchema: {
      description: "How a message's star is put back in step with its state",
    },
    required: false,
  })
  @ApiQuery({
    name: "offset",
    description: "How many to pass over",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "limit",
    description: `At most this many, up to ${MAX_STAR_PAGE}`,
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "A page of mismatches, and the counts.",
    type: ListMailStarMismatchesResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Query("accountId") accountId: string | undefined,
    @Query("fix", new ParseEnumPipe(MailStarFix, { optional: true }))
    fix: MailStarFix | undefined,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const body: ListMailStarMismatchesResponse = await this.stars.mismatches(
      user.userId,
      { accountId, fix, offset, limit },
    );
    response.status(HttpStatus.OK).send(body);
  }
}

import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import {
  CreateGmailFilterRequest,
  CreateGmailFilterResponse,
} from "../../model/gmail";
import { GmailFilters } from "../GmailFilters";

/**
 * CreateGmailFilter: a filter made in Gmail for the API (phase 7): mail
 * from a sender gets a label, and skips the inbox when asked (201).
 */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class CreateGmailFilterController {
  constructor(private readonly filters: GmailFilters) {}

  @Post("/gmail-filters")
  async handle(
    @Body() request: CreateGmailFilterRequest,
    @Res() response: Response,
  ): Promise<void> {
    const body: CreateGmailFilterResponse = {
      filterId: await this.filters.create(request),
    };
    response.status(HttpStatus.CREATED).send(body);
  }
}

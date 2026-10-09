import {
  Controller,
  Delete,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { type Response } from "express";
import { ServicesOnlyGuard } from "../../auth/ServicesOnlyGuard";
import { GmailFilters } from "../GmailFilters";

/** DeleteGmailFilter: a filter the API made, deleted in Gmail (204). */
@Controller({ version: "1" })
@UseGuards(ServicesOnlyGuard)
export class DeleteGmailFilterController {
  constructor(private readonly filters: GmailFilters) {}

  @Delete("/gmail-filters/:filterId")
  async handle(
    @Param("filterId") filterId: string,
    @Query("email") email: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.filters.delete(email, filterId);
    response.status(HttpStatus.NO_CONTENT).send();
  }
}

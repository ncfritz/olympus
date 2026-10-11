import { Controller, Get, Res, VERSION_NEUTRAL } from "@nestjs/common";
import type { Response } from "express";
import { AcmeRoute } from "../acmeRoute";
import { AcmeDirectoryService } from "../services/AcmeDirectoryService";

/** RFC 8555 §7.1.1: the directory, which an ACME client is given. */
@AcmeRoute()
@Controller({ version: VERSION_NEUTRAL })
export class AcmeDirectoryController {
  constructor(private readonly directory: AcmeDirectoryService) {}

  @Get("/acme/directory")
  handle(@Res() response: Response): void {
    response.status(200).json(this.directory.directory());
  }
}

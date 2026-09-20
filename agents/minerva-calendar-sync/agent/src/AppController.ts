import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { AppService } from "./AppService";
import { Public } from "./auth/public";

@ApiExcludeController()
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

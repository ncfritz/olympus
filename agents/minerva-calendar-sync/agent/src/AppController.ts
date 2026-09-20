import { Controller, Get } from "@nestjs/common";
import { AppService } from "./AppService";
import { Public } from "./auth/public";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

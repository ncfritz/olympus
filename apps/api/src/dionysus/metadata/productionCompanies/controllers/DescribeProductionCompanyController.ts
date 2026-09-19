import { DescribeProductionCompanyResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ProductionCompanyService } from "../services/ProductionCompanyService";

@Controller({ version: "1" })
export class DescribeProductionCompanyController {
  constructor(private readonly productionCompanies: ProductionCompanyService) {}

  @Get("/metadata/productionCompany/:productionCompanyId")
  @ApiOperation({
    summary: "Describes a production company in Dionysus",
    description: "Retrieves the details of a production company in Dionysus.",
    operationId: "DescribeProductionCompany",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "productionCompanyId",
    description: "The ID of the production company to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeProductionCompanyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("productionCompanyId", ParseIntPipe) productionCompanyId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeProductionCompanyResponse = {
      company: await this.productionCompanies.describe(productionCompanyId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}

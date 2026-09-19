import {
  CreateProductionCompanyRequest,
  CreateProductionCompanyResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { DescribeProductionCompanyController } from "./DescribeProductionCompanyController";
import { setLocation } from "../../../../utils/location";
import { ProductionCompanyService } from "../services/ProductionCompanyService";

@Controller({ version: "1" })
export class CreateProductionCompanyController {
  constructor(private readonly productionCompanies: ProductionCompanyService) {}

  @Put("/metadata/productionCompanies")
  @ApiOperation({
    summary: "Upserts a production company",
    description: "Creates or updates a production company.",
    operationId: "CreateProductionCompany",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateProductionCompanyRequest,
    required: true,
    description: "Input for the CreateProductionCompany operation",
  })
  @ApiCreatedResponse({
    type: CreateProductionCompanyResponse,
    description: "The record has been successfully created.",
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created production company1",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateProductionCompanyRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const company = await this.productionCompanies.create(request.company);

    const responseBody: CreateProductionCompanyResponse = {
      company: company,
    };

    setLocation(response, httpRequest, DescribeProductionCompanyController, {
      productionCompanyId: company.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}

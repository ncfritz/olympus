import {
  CreateCertificationRequest,
  CreateCertificationResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { CertificationService } from "../services/CertificationService";

@Controller({ version: "1" })
export class CreateCertificationController {
  constructor(private readonly certifications: CertificationService) {}

  @Put("/metadata/certifications")
  @ApiOperation({
    summary: "Upserts a Movie or TV certification",
    description: "Creates or updates a movie or TV certification.",
    operationId: "CreateCertification",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateCertificationRequest,
    required: true,
    description: "Input for the CreateCertification operation",
  })
  @ApiCreatedResponse({
    type: CreateCertificationResponse,
    description: "The record has been successfully created.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateCertificationRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: CreateCertificationResponse = {
      certification: await this.certifications.create(request.certification),
    };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}

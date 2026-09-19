import {
  CreatePersonRequest,
  CreatePersonResponse,
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
import { DescribePersonController } from "./DescribePersonController";
import { setLocation } from "../../../../utils/location";
import { PersonService } from "../services/PersonService";

@Controller({ version: "1" })
export class CreatePersonController {
  constructor(private readonly people: PersonService) {}

  @Put("/metadata/people")
  @ApiOperation({
    summary: "Upserts a person",
    description: "Creates or updates a person.",
    operationId: "CreatePerson",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreatePersonRequest,
    required: true,
    description: "Input for the CreatePerson operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreatePersonResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created person",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreatePersonRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const id = await this.people.create(request.person);

    const responseBody: CreatePersonResponse = {
      id: id,
    };

    setLocation(response, httpRequest, DescribePersonController, {
      personId: id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}

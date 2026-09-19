import {
  CreateContentAssetRequest,
  CreateContentAssetResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { GetContentAssetController } from "./GetContentAssetController";
import { setLocation } from "../../../../utils/location";
import { ContentAssetService } from "../services/ContentAssetService";

@Controller({ version: "1" })
export class CreateContentAssetController {
  constructor(private readonly contentAssets: ContentAssetService) {}

  @Post("/content/assets")
  @ApiOperation({
    summary: "Creates a new content asset",
    description:
      "Creates a new content asset.  New assets are assigned their ID by the ingestion process.",
    operationId: "CreateContentAsset",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetRequest,
    required: true,
    description: "Input for the CreateContentAsset operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created content asset",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const createdContentAsset = await this.contentAssets.create(request.asset);

    const responseBody: CreateContentAssetResponse = {
      asset: createdContentAsset,
    };

    setLocation(response, httpRequest, GetContentAssetController, {
      assetId: createdContentAsset.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}

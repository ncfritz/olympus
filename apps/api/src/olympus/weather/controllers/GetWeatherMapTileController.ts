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
  ApiResponse,
} from "@nestjs/swagger";
import { WeatherMapLayer } from "@ncfritz/olympus-model";
import { type Response } from "express";
import { RequiresIdentity } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherTileService } from "../services/WeatherTileService";

/** OpenWeather's map layers, proxied so the key never reaches a browser. */
@Controller({ version: "1" })
export class GetWeatherMapTileController {
  constructor(private readonly weatherTiles: WeatherTileService) {}

  @Get("/weather/map/:layer/:z/:x/:y")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets a forecast map layer tile",
    description:
      "One tile of a forecast layer from OpenWeather, cached by the API and marked for the browser to cache for as long as the API will.",
    operationId: "GetWeatherMapTile",
    tags: ["Weather"],
  })
  @ApiProduces("image/png")
  @ApiParam({
    name: "layer",
    description: "The layer to draw",
    enum: WeatherMapLayer,
    enumName: "WeatherMapLayer",
  })
  @ApiParam({ name: "z", description: "The zoom level", type: Number })
  @ApiParam({
    name: "x",
    description: "The tile column at that zoom",
    type: Number,
  })
  @ApiParam({
    name: "y",
    description: "The tile row at that zoom",
    type: Number,
  })
  @ApiOkResponse({
    description: "The tile, a 256-pixel PNG.",
    content: { "image/png": { schema: { type: "string", format: "binary" } } },
    headers: {
      "Cache-Control": {
        schema: { type: "string" },
        description: "How long the browser may keep the tile",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      "The provider is not answering, is rate limiting this server, or is not configured.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("layer") layer: string,
    @Param("z", ParseIntPipe) z: number,
    @Param("x", ParseIntPipe) x: number,
    @Param("y", ParseIntPipe) y: number,
    @Res() response: Response,
  ): Promise<void> {
    const tile = await this.weatherTiles.layerTile(layer, z, x, y);
    response
      .status(HttpStatus.OK)
      .type("image/png")
      .set("Cache-Control", `private, max-age=${tile.maxAgeSeconds}`)
      .send(tile.png);
  }
}

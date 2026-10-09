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
import { type Response } from "express";
import { RequiresIdentity } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { WeatherTileService } from "../services/WeatherTileService";

/** RainViewer's past radar, proxied and cached for as long as a frame lives. */
@Controller({ version: "1" })
export class GetRadarTileController {
  constructor(private readonly weatherTiles: WeatherTileService) {}

  @Get("/weather/radar/:frameId/:z/:x/:y")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets a radar tile",
    description:
      "One tile of a past radar frame from RainViewer. Zoom 7 is the finest there is; a map at a closer zoom scales these tiles up.",
    operationId: "GetRadarTile",
    tags: ["Weather"],
  })
  @ApiProduces("image/png")
  @ApiParam({
    name: "frameId",
    description: "A frame ID from ListRadarFrames",
    type: String,
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
    @Param("frameId") frameId: string,
    @Param("z", ParseIntPipe) z: number,
    @Param("x", ParseIntPipe) x: number,
    @Param("y", ParseIntPipe) y: number,
    @Res() response: Response,
  ): Promise<void> {
    const tile = await this.weatherTiles.radarTile(frameId, z, x, y);
    response
      .status(HttpStatus.OK)
      .type("image/png")
      .set("Cache-Control", `private, max-age=${tile.maxAgeSeconds}`)
      .send(tile.png);
  }
}

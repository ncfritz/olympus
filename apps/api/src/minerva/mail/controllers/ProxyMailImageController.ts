import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { Public } from "../../../auth/authDecorators";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import {
  MailImageFetcher,
  MailImageFetchError,
} from "../services/MailImageFetcher";
import { MailImageProxy } from "../services/MailImageProxy";

/**
 * A remote image in a message the user opened, fetched by the API so the
 * browser never reaches the sender's servers. The message viewer's frame
 * carries no access token (it is sandboxed, with no origin of its own),
 * so the token in the path is the authorisation: signed by this API when
 * it returned the message, naming one URL, for an hour.
 */
@Controller({ version: "1" })
export class ProxyMailImageController {
  private readonly logger = new Logger(ProxyMailImageController.name);

  constructor(
    private readonly proxy: MailImageProxy,
    private readonly fetcher: MailImageFetcher,
  ) {}

  @Get("/mail/image/:token")
  @Public()
  @ApiOperation({
    summary: "Fetches a remote image of a message for its viewer",
    description:
      "The message viewer's images (docs/plans/email-management phase 5): GetMailMessageContent rewrites the HTML's remote image URLs to this operation, each with a token signed by the API that names one URL and expires after an hour. The API fetches the image itself, from a public address only (never this host, the LAN or the Docker networks), on port 80 or 443, following at most three redirects, each checked again; PNG, JPEG, GIF, WebP, AVIF, BMP or ICO only (no SVG), at most 5 MB in 10 seconds, eight at a time, the bytes checked against the type. No cookie, referrer or browser of the user's reaches the sender. Not found when the token is forged or expired, or the image cannot be fetched; why is logged, never the URL.",
    operationId: "ProxyMailImage",
    tags: ["Mail"],
  })
  @ApiProduces("image/png", "image/jpeg", "image/gif", "image/webp")
  @ApiParam({
    name: "token",
    description: "The signed token GetMailMessageContent put in the HTML",
    type: String,
  })
  @ApiOkResponse({
    description: "The image.",
    schema: { type: "string", format: "binary" },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("token") token: string,
    @Res() response: Response,
  ): Promise<void> {
    const url = this.proxy.verify(token);
    if (!url) throw new NotFoundException("No such image");
    let image;
    try {
      image = await this.fetcher.fetch(url);
    } catch (error) {
      // Why, never the URL: it can say who wrote to whom.
      this.logger.debug(
        `Did not proxy an image: ${error instanceof MailImageFetchError ? error.message : error instanceof Error ? error.name : "unknown"}`,
      );
      throw new NotFoundException("No such image");
    }
    response
      .status(HttpStatus.OK)
      .set({
        "Content-Type": image.contentType,
        "Content-Length": String(image.body.length),
        // The token expires within the hour; the browser may keep it as long.
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
        // Shown by a frame with no origin of its own.
        "Cross-Origin-Resource-Policy": "cross-origin",
      })
      .send(image.body);
  }
}

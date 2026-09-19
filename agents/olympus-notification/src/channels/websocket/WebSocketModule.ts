import { Module } from "@nestjs/common";
import { WebSocketFormatters } from "./formatters/WebSocketFormatters";
import { WebSocketHandler } from "./handlers/WebSocketHandler";
import { WebSocketPublisher } from "./services/WebSocketPublisher";

/** Notifications relayed to browsers (queue notifications.ws). */
@Module({
  providers: [WebSocketFormatters, WebSocketHandler, WebSocketPublisher],
})
export class WebSocketModule {}

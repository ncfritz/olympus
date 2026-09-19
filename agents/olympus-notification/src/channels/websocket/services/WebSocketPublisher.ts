import { Inject, Injectable, Logger } from "@nestjs/common";
import { io } from "socket.io-client";
import { olympusConfig } from "../../../config/configuration";
import type { OlympusConfigType } from "../../../config/configuration";

/** Relays events to browsers through the API's Socket.IO gateway. */
@Injectable()
export class WebSocketPublisher {
  private readonly logger = new Logger(WebSocketPublisher.name);

  constructor(
    @Inject(olympusConfig.KEY) private readonly olympus: OlympusConfigType,
  ) {}

  publish(event: object): void {
    this.logger.log(`Publishing event to ${this.olympus.webSocketHost}...`);
    const socket = io(`${this.olympus.webSocketHost}/notifications`);
    socket.emit("notification.proxy_to_frontend", event);
  }
}

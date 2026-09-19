import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { io, type Socket } from "socket.io-client";
import { olympusConfig } from "../../../config/configuration";
import type { OlympusConfigType } from "../../../config/configuration";

/**
 * Relays events to browsers through the API's Socket.IO gateway over one
 * long-lived connection. Socket.IO reconnects on its own and buffers
 * events emitted while disconnected.
 */
@Injectable()
export class WebSocketPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(WebSocketPublisher.name);
  private socket?: Socket;

  constructor(
    @Inject(olympusConfig.KEY) private readonly olympus: OlympusConfigType,
  ) {}

  publish(event: object): void {
    if (!this.socket) {
      const url = `${this.olympus.webSocketHost}/notifications`;
      this.logger.log(`Connecting to ${url}`);
      this.socket = io(url);
    }
    this.socket.emit("notification.proxy_to_frontend", event);
  }

  onModuleDestroy(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}

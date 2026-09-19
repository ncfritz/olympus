import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "notifications",
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket): void {
    client.emit("message", "Welcome to the server!");
    this.logger.log(`Client connected...${client.id}`);
  }

  afterInit(_server: Server): void {
    this.logger.log("Init complete...");
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnect...${client.id}`);
  }

  @SubscribeMessage("notification.proxy_to_frontend")
  handleProxyNotificationEvent(
    @MessageBody() data: string,
    @ConnectedSocket() _client: Socket,
  ): void {
    this.send("notification.push", data);
  }

  @SubscribeMessage("notification.client_refresh")
  handleClientRefreshEvent(
    @MessageBody() data: string,
    @ConnectedSocket() _client: Socket,
  ): void {
    this.send("notification.refresh", data);
  }

  send(messageName: string, message: unknown) {
    this.logger.debug(`Sending "${messageName}" message via WebSocketGateway`);

    this.server.emit(messageName, message);
  }
}

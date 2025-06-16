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
  @WebSocketServer()
  server: Server;

  handleConnection(client: any, ...args: any[]): any {
    client.emit("message", "Welcome to the server!");
    console.log(`Client connected...${client.id}`);
  }

  afterInit(server: Server): any {
    console.log("Init complete...");
  }

  handleDisconnect(client: any): any {
    console.log(`Client disconnect...${client.id}`);
  }

  @SubscribeMessage("notification.proxy_to_frontend")
  handleProxyNotificationEvent(
    @MessageBody() data: string,
    @ConnectedSocket() client: Socket,
  ): void {
    this.send("notification.push", data);
  }

  @SubscribeMessage("notification.client_refresh")
  handleClientRefreshEvent(
    @MessageBody() data: string,
    @ConnectedSocket() client: Socket,
  ): void {
    this.send("notification.refresh", data);
  }

  send(messageName: string, message: any) {
    console.info(`Sending "${messageName}" message via WebSocketGateway`);

    this.server.emit(messageName, message);
  }
}

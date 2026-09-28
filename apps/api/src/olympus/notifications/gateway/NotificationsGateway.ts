import { Inject, Logger } from "@nestjs/common";
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
import { authConfig, type AuthConfigType } from "../../../config/configuration";
import { recordAuthDecision } from "../../../auth/authMetrics";
import type { UserPrincipal } from "../../../auth/principal";
import { UserIdentityService } from "../../../auth/users/UserIdentityService";

/**
 * The access token a client presents when it connects.
 *
 * `auth` is Socket.IO's own handshake payload and the right place for it: a
 * WebSocket upgrade cannot carry an `Authorization` header the browser will set,
 * and a token in the query string ends up in access logs. `query` is read as
 * well, for a client that cannot set `auth` -- and it is the less good option
 * for exactly that reason.
 */
const presentedToken = (client: Socket): string => {
  const handshake = client.handshake;
  const offered = (handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof offered === "string") return offered;
  const queried = handshake.query.token;
  return typeof queried === "string" ? queried : "";
};

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

  constructor(
    private readonly users: UserIdentityService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  /**
   * Authenticates the connection (ADR 0018), because until now this accepted
   * anyone who could reach the port and then sent them every notification.
   *
   * The same `AUTH_MODE_USERS` the HTTP guard obeys: in `report` mode an
   * unauthenticated socket is logged and counted and still connected, so the
   * site can be moved over without a flag day. The token is verified by the
   * same code as a request's, so a socket and a call cannot disagree about it.
   *
   * A connection is authenticated once, at the upgrade, and an access token
   * lives ten minutes -- so a long-lived socket outlives the token that opened
   * it. That is deliberate: the alternative is dropping a notification stream
   * mid-session, and what the token proves here is who opened it.
   */
  async handleConnection(client: Socket): Promise<void> {
    const identified = await this.users.identifyToken(presentedToken(client));
    const enforcing = this.auth.modes.users === "enforce";

    if ("reason" in identified) {
      recordAuthDecision(
        "users",
        enforcing ? "reject" : "would_reject",
        identified.reason,
      );
      this.logger.warn(
        `${enforcing ? "refused" : "would refuse"} a notifications socket: ${identified.reason}`,
      );
      if (enforcing) {
        // `true` closes the underlying connection rather than only the
        // namespace, so a refused client is not left holding an open socket.
        client.disconnect(true);
        return;
      }
    } else {
      recordAuthDecision("users", "allow", undefined);
      (client.data as { principal?: UserPrincipal }).principal =
        identified.principal;
    }

    client.emit("message", "Welcome to the server!");
    this.logger.log(
      `Client connected...${client.id}${
        "reason" in identified ? " (unauthenticated)" : ""
      }`,
    );
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

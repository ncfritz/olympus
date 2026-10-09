import type { Socket } from "socket.io";
import { describe, expect, it, vi } from "vitest";
import type { AuthConfigType } from "../../../../../src/config/configuration";
import type { UserPrincipal } from "../../../../../src/auth/principal";
import type { UserIdentityService } from "../../../../../src/auth/users/UserIdentityService";
import { NotificationsGateway } from "../../../../../src/olympus/notifications/gateway/NotificationsGateway";

const PRINCIPAL: UserPrincipal = {
  kind: "user",
  userId: "5f1a0c6e-0000-4000-8000-000000000001",
  roles: ["user"],
  client: "olympus-site",
  sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
};

const gateway = (
  identified: { principal: UserPrincipal } | { reason: string },
  mode: "report" | "enforce",
) =>
  new NotificationsGateway(
    {
      identifyToken: vi.fn(async () => identified),
    } as unknown as UserIdentityService,
    { modes: { users: mode, services: mode } } as unknown as AuthConfigType,
  );

const socket = (handshake: { auth?: unknown; query?: unknown }) =>
  ({
    id: "a-socket",
    data: {},
    handshake: { auth: handshake.auth ?? {}, query: handshake.query ?? {} },
    emit: vi.fn(),
    disconnect: vi.fn(),
  }) as unknown as Socket & { disconnect: ReturnType<typeof vi.fn> };

describe("the notifications gateway", () => {
  it("keeps the principal of a connection it authenticated", async () => {
    const client = socket({ auth: { token: "a-token" } });
    await gateway({ principal: PRINCIPAL }, "enforce").handleConnection(client);

    expect((client.data as { principal?: UserPrincipal }).principal).toEqual(
      PRINCIPAL,
    );
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("closes the whole connection of a socket it refuses, in enforce mode", async () => {
    const client = socket({});
    await gateway({ reason: "no credentials" }, "enforce").handleConnection(
      client,
    );

    // `true`, so a refused client is not left holding an open socket on the
    // default namespace.
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  /**
   * The same `AUTH_MODE_USERS` the HTTP guard obeys, so the site can be moved
   * over without a flag day: what would have been refused is logged and counted,
   * and still connected.
   */
  it("connects an unauthenticated socket in report mode", async () => {
    const client = socket({});
    await gateway({ reason: "no credentials" }, "report").handleConnection(
      client,
    );

    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalled();
    expect(
      (client.data as { principal?: UserPrincipal }).principal,
    ).toBeUndefined();
  });

  it("reads the token from the handshake, and from the query as a fallback", async () => {
    const identify = vi.fn(async () => ({ principal: PRINCIPAL }));
    const made = new NotificationsGateway(
      { identifyToken: identify } as unknown as UserIdentityService,
      { modes: { users: "enforce" } } as unknown as AuthConfigType,
    );

    await made.handleConnection(socket({ auth: { token: "from-auth" } }));
    expect(identify).toHaveBeenLastCalledWith("from-auth");

    await made.handleConnection(socket({ query: { token: "from-query" } }));
    expect(identify).toHaveBeenLastCalledWith("from-query");

    await made.handleConnection(socket({}));
    expect(identify).toHaveBeenLastCalledWith("");
  });
});

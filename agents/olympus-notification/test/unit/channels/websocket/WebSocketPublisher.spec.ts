import { io } from "socket.io-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketPublisher } from "../../../../src/channels/websocket/services/WebSocketPublisher";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

describe("WebSocketPublisher", () => {
  const socket = { emit: vi.fn(), close: vi.fn() };

  beforeEach(() => {
    vi.mocked(io)
      .mockReset()
      .mockReturnValue(socket as never);
    socket.emit.mockReset();
    socket.close.mockReset();
  });

  const publisher = () =>
    new WebSocketPublisher({
      apiBaseUrl: "http://api.test/v1",
      apiHost: "http://api.test",
      webSocketHost: "ws://ws.test",
    });

  it("reuses one connection for every event", () => {
    const p = publisher();
    p.publish({ n: 1 });
    p.publish({ n: 2 });
    expect(io).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledWith("ws://ws.test/notifications");
    expect(socket.emit.mock.calls).toEqual([
      ["notification.proxy_to_frontend", { n: 1 }],
      ["notification.proxy_to_frontend", { n: 2 }],
    ]);
  });

  it("closes the connection on shutdown", () => {
    const p = publisher();
    p.onModuleDestroy();
    expect(socket.close).not.toHaveBeenCalled();
    p.publish({});
    p.onModuleDestroy();
    expect(socket.close).toHaveBeenCalledOnce();
  });
});

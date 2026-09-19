import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketFormatters } from "../../../../src/channels/websocket/formatters/WebSocketFormatters";
import { WebSocketHandler } from "../../../../src/channels/websocket/handlers/WebSocketHandler";
import type { WebSocketPublisher } from "../../../../src/channels/websocket/services/WebSocketPublisher";
import { webSocketEvent } from "../../../fixtures/events";

vi.mock("axios");

describe("WebSocketHandler", () => {
  const publish = vi.fn();
  const handler = new WebSocketHandler(
    new WebSocketFormatters(),
    { publish } as unknown as WebSocketPublisher,
    {
      apiBaseUrl: "http://api.test/v1",
      apiHost: "http://api.test",
      webSocketHost: "ws://ws.test",
    },
  );

  beforeEach(() => {
    publish.mockReset();
    vi.mocked(axios.post).mockReset();
  });

  it("relays the formatted notification to browsers", async () => {
    await handler.handle(webSocketEvent({ level: "warning" }));
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: "notification-1",
        messageType: "system_test",
        level: "warning",
        durable: false,
        closable: true,
        deleteOnClose: false,
        visibleDuration: 5000,
        payload: {
          type: "plain",
          value: { title: "Test", message: "This is a test message" },
        },
      }),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("stores durable notifications in the API", async () => {
    await handler.handle(
      webSocketEvent({ durable: true, group: "g-1", ttl: "P1D" }),
    );
    expect(axios.post).toHaveBeenCalledWith(
      "http://api.test/v1/notifications",
      {
        notification: expect.objectContaining({
          acknowledged: false,
          notificationId: "notification-1",
          notificationType: "system_test",
          eventId: "event-1",
          group: "g-1",
          ttl: "P1D",
        }),
      },
    );
  });

  it("does not throw when the relay fails", async () => {
    publish.mockImplementationOnce(() => {
      throw new Error("socket closed");
    });
    await expect(handler.handle(webSocketEvent())).resolves.toBeUndefined();
  });
});

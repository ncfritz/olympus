import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketFormatters } from "../../../../src/channels/websocket/formatters/WebSocketFormatters";
import { WebSocketHandler } from "../../../../src/channels/websocket/handlers/WebSocketHandler";
import type { NotificationApi } from "../../../../src/api/NotificationApi";
import type { WebSocketPublisher } from "../../../../src/channels/websocket/services/WebSocketPublisher";
import { webSocketEvent } from "../../../fixtures/events";

describe("WebSocketHandler", () => {
  const publish = vi.fn();
  const createNotification = vi.fn();
  const handler = new WebSocketHandler(
    new WebSocketFormatters(),
    { publish } as unknown as WebSocketPublisher,
    { createNotification } as unknown as NotificationApi,
  );

  beforeEach(() => {
    publish.mockReset();
    createNotification.mockReset();
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
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("stores durable notifications through the SDK", async () => {
    await handler.handle(
      webSocketEvent({ durable: true, group: "g-1", ttl: "P1D" }),
    );
    expect(createNotification).toHaveBeenCalledWith({
      acknowledged: false,
      notificationId: "notification-1",
      notificationType: "system_test",
      level: "info",
      payload: {
        type: "plain",
        value: { title: "Test", message: "This is a test message" },
      },
      eventId: "event-1",
      group: "g-1",
      ttl: "P1D",
    });
  });

  it("does not throw when the relay fails", async () => {
    publish.mockImplementationOnce(() => {
      throw new Error("socket closed");
    });
    await expect(handler.handle(webSocketEvent())).resolves.toBeUndefined();
  });
});

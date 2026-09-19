import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SynoChatFormatters } from "../../../../src/channels/synochat/formatters/SynoChatFormatters";
import { SynoChatHandler } from "../../../../src/channels/synochat/handlers/SynoChatHandler";
import { synoChatEvent } from "../../../fixtures/events";

vi.mock("axios");

const CHAT =
  "https://chat.test/webapi/entry.cgi?api=SYNO.Chat.External&version=2";

describe("SynoChatHandler", () => {
  const handler = new SynoChatHandler(new SynoChatFormatters(), {
    host: "https://chat.test",
    olympusBotToken: "bot-token",
    olympusChannelToken: "channel-token",
  });

  beforeEach(() => {
    vi.mocked(axios.post).mockReset().mockResolvedValue({ data: {} });
  });

  it("posts to the channel webhook", async () => {
    await handler.handle(synoChatEvent());
    expect(axios.post).toHaveBeenCalledWith(
      `${CHAT}&method=incoming&token=%22channel-token%22`,
      'payload={"text":"This is a test message"}',
      { headers: { "Content-Type": "text/plain" } },
    );
  });

  it("posts to the bot webhook with the user ids", async () => {
    await handler.handle(
      synoChatEvent({ destinationType: "bot", users: [4, 7] }),
    );
    expect(axios.post).toHaveBeenCalledWith(
      `${CHAT}&method=chatbot&token=%22bot-token%22`,
      'payload={"text":"This is a test message","user_ids":[4,7]}',
      expect.anything(),
    );
  });

  it("skips unknown destinations and destinations without a token", async () => {
    await handler.handle(synoChatEvent({ destination: "elsewhere" }));
    const noTokens = new SynoChatHandler(new SynoChatFormatters(), {
      host: "https://chat.test",
    });
    await noTokens.handle(synoChatEvent());
    expect(axios.post).not.toHaveBeenCalled();
  });
});

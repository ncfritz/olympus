import { describe, expect, it, vi } from "vitest";
import type { GmailConfigType } from "../../../src/config/configuration";
import type { GmailClient, GmailMailbox } from "../../../src/gmail/GmailClient";
import type { GmailCredentialStore } from "../../../src/gmail/GmailCredentialStore";
import { GmailFilters } from "../../../src/gmail/GmailFilters";

const SETTINGS = "https://www.googleapis.com/auth/gmail.settings.basic";

const setup = (
  options: { enabled?: boolean; scope?: string; deleteStatus?: number } = {},
) => {
  const mailbox = {
    labels: vi.fn(async () => [
      { id: "INBOX", name: "INBOX", type: "system" },
      { id: "Label_7", name: "Shopping/Receipts", type: "user" },
    ]),
    createFilter: vi.fn(async () => "ANe1Bmj"),
    deleteFilter: vi.fn(async () => {
      if (options.deleteStatus) {
        throw Object.assign(new Error("gone"), {
          response: { status: options.deleteStatus },
        });
      }
    }),
  };
  const filters = new GmailFilters(
    {
      clientId: "id",
      filtersEnabled: options.enabled ?? true,
    } as GmailConfigType,
    {} as GmailClient,
    {
      load: vi.fn(() => ({
        refreshToken: "never-printed",
        scope: options.scope ?? `openid email ${SETTINGS}`,
      })),
    } as unknown as GmailCredentialStore,
  );
  const open = () => mailbox as unknown as GmailMailbox;
  return { filters, mailbox, open };
};

const request = {
  email: "neil@example.com",
  from: "orders@shop.example",
  label: "Shopping/Receipts",
  skipInbox: true,
};

describe("GmailFilters", () => {
  it("labels the sender's mail and skips the inbox", async () => {
    const { filters, mailbox, open } = setup();
    expect(await filters.create(request, open)).toBe("ANe1Bmj");
    expect(mailbox.createFilter).toHaveBeenCalledWith(
      "orders@shop.example",
      ["Label_7"],
      ["INBOX"],
    );
    await filters.create({ ...request, skipInbox: false }, open);
    expect(mailbox.createFilter).toHaveBeenLastCalledWith(
      "orders@shop.example",
      ["Label_7"],
      [],
    );
  });

  it("refuses a label Gmail lacks, and a mailbox linked without the scope", async () => {
    const { filters, open } = setup();
    await expect(
      filters.create({ ...request, label: "Gone" }, open),
    ).rejects.toMatchObject({ status: 404 });
    const unlinked = setup({ scope: "openid email" });
    await expect(
      unlinked.filters.create(request, unlinked.open),
    ).rejects.toMatchObject({ status: 409 });
    const off = setup({ enabled: false });
    await expect(off.filters.create(request, off.open)).rejects.toMatchObject({
      status: 503,
    });
    await expect(
      filters.create({ ...request, from: "not an address" }, open),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("deletes a filter, one already gone included", async () => {
    const { filters, mailbox, open } = setup();
    await filters.delete("neil@example.com", "ANe1Bmj", open);
    expect(mailbox.deleteFilter).toHaveBeenCalledWith("ANe1Bmj");
    const gone = setup({ deleteStatus: 404 });
    await gone.filters.delete("neil@example.com", "ANe1Bmj", gone.open);
    const failing = setup({ deleteStatus: 500 });
    await expect(
      failing.filters.delete("neil@example.com", "ANe1Bmj", failing.open),
    ).rejects.toThrow("gone");
  });
});

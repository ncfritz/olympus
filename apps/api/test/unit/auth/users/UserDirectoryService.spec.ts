import type { GraphQLClient } from "graphql-request";
import { describe, expect, it, vi } from "vitest";
import { UserDirectoryService } from "../../../../src/auth/users/UserDirectoryService";

const ROW = {
  id: "5f1a0c6e-0000-4000-8000-000000000001",
  displayName: "Neil",
  email: "neil@example.com",
  disabled: false,
  roles: [{ role: "admin" }, { role: "user" }],
};

const USER = {
  id: ROW.id,
  displayName: "Neil",
  email: "neil@example.com",
  roles: ["admin", "user"],
};

const identity = (over: Record<string, unknown> = {}) => ({
  provider: "google",
  subject: "google-subject-1",
  email: "neil@example.com",
  emailVerified: true,
  ...over,
});

/**
 * A client that answers each operation by name. Hasura's own behaviour is
 * not what these test — the resolution rules are.
 */
const client = (answers: Record<string, unknown>) => {
  const calls: { operation: string; variables: unknown }[] = [];
  const request = vi.fn(async (query: string, variables?: unknown) => {
    const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "?";
    calls.push({ operation, variables });
    if (!(operation in answers)) throw new Error(`unexpected ${operation}`);
    return answers[operation];
  });
  return { calls, graphql: { request } as unknown as GraphQLClient, request };
};

describe("resolve", () => {
  it("returns the user behind a known identity, without touching email", async () => {
    const { graphql, calls } = client({
      DescribeUserByIdentity: { olympus_user_identities: [{ user: ROW }] },
    });
    const result = await new UserDirectoryService(graphql).resolve(identity());
    expect(result).toEqual({ user: USER });
    expect(calls.map((call) => call.operation)).toEqual([
      "DescribeUserByIdentity",
    ]);
  });

  it("links a new identity to a user with the same verified email", async () => {
    const { graphql, calls } = client({
      DescribeUserByIdentity: { olympus_user_identities: [] },
      DescribeUserByEmail: { olympus_users: [ROW] },
      CreateUserIdentity: { insert_olympus_user_identities_one: { id: "x" } },
    });
    const service = new UserDirectoryService(graphql);
    vi.spyOn(service["logger"], "log").mockImplementation(() => undefined);
    expect(await service.resolve(identity())).toEqual({ user: USER });
    expect(calls.map((call) => call.operation)).toEqual([
      "DescribeUserByIdentity",
      "DescribeUserByEmail",
      "CreateUserIdentity",
    ]);
  });

  it("refuses an email the provider has not verified, before looking it up", async () => {
    // Otherwise anyone who can set their profile email to yours becomes you.
    const { graphql, calls } = client({
      DescribeUserByIdentity: { olympus_user_identities: [] },
    });
    expect(
      await new UserDirectoryService(graphql).resolve(
        identity({ emailVerified: false }),
      ),
    ).toEqual({ reason: "google did not verify neil@example.com" });
    expect(calls.map((call) => call.operation)).toEqual([
      "DescribeUserByIdentity",
    ]);
  });

  it("refuses a verified email that belongs to nobody", async () => {
    const { graphql } = client({
      DescribeUserByIdentity: { olympus_user_identities: [] },
      DescribeUserByEmail: { olympus_users: [] },
    });
    expect(await new UserDirectoryService(graphql).resolve(identity())).toEqual(
      {
        reason: "no user with the email google gave",
      },
    );
  });

  it("refuses a disabled user whose identity is known", async () => {
    const { graphql } = client({
      DescribeUserByIdentity: {
        olympus_user_identities: [{ user: { ...ROW, disabled: true } }],
      },
    });
    expect(await new UserDirectoryService(graphql).resolve(identity())).toEqual(
      {
        reason: `user ${ROW.id} is disabled`,
      },
    );
  });

  it("refuses a disabled user before linking a new identity to them", async () => {
    const { graphql, calls } = client({
      DescribeUserByIdentity: { olympus_user_identities: [] },
      DescribeUserByEmail: { olympus_users: [{ ...ROW, disabled: true }] },
    });
    expect(await new UserDirectoryService(graphql).resolve(identity())).toEqual(
      {
        reason: `user ${ROW.id} is disabled`,
      },
    );
    expect(calls.map((call) => call.operation)).not.toContain(
      "CreateUserIdentity",
    );
  });

  it("lowercases the email it looks up and the one it stores", async () => {
    const { graphql, calls } = client({
      DescribeUserByIdentity: { olympus_user_identities: [] },
      DescribeUserByEmail: { olympus_users: [ROW] },
      CreateUserIdentity: { insert_olympus_user_identities_one: { id: "x" } },
    });
    const service = new UserDirectoryService(graphql);
    vi.spyOn(service["logger"], "log").mockImplementation(() => undefined);
    await service.resolve(identity({ email: "  Neil@Example.COM " }));
    const byEmail = calls.find((c) => c.operation === "DescribeUserByEmail");
    const link = calls.find((c) => c.operation === "CreateUserIdentity");
    // The column carries a CHECK that it equals lower(email), so anything
    // else would be a row nobody can find, or a failed insert.
    expect(byEmail?.variables).toMatchObject({ email: "neil@example.com" });
    expect(link?.variables).toMatchObject({ email: "neil@example.com" });
  });
});

describe("createSession", () => {
  it("returns when the session began, for the token's auth_time", async () => {
    const { graphql, calls } = client({
      CreateSession: {
        insert_olympus_sessions_one: {
          id: "session-1",
          createdTime: "2026-09-24T12:00:00+00:00",
        },
      },
    });
    const result = await new UserDirectoryService(graphql).createSession({
      userId: ROW.id,
      clientId: "olympus-site",
      refreshTokenHash: "hash",
      expiresAt: new Date("2026-10-24T12:00:00Z"),
    });
    expect(result.createdTime).toBe("2026-09-24T12:00:00+00:00");
    expect(calls[0]?.variables).toMatchObject({
      clientId: "olympus-site",
      deviceName: null,
      expiresTime: "2026-10-24T12:00:00.000Z",
    });
  });
});

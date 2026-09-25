import type { GraphQLClient } from "graphql-request";
import { describe, expect, it, vi } from "vitest";
import {
  UserAdministration,
  UserAdministrationError,
} from "../../../../src/auth/users/UserAdministration";

const ID = "5f1a0c6e-0000-4000-8000-000000000001";

const ROW = {
  id: ID,
  displayName: "Neil",
  email: "Neil@Example.com",
  disabled: false,
  roles: [{ role: "user" }, { role: "admin" }],
  identities: [
    { provider: "google", subject: "g-1", email: "neil@example.com" },
  ],
};

/** A client that answers each operation by name, and records the calls. */
const client = (answers: Record<string, unknown>) => {
  const calls: { operation: string; variables: unknown }[] = [];
  const request = vi.fn(async (query: string, variables?: unknown) => {
    const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "?";
    calls.push({ operation, variables });
    if (!(operation in answers)) throw new Error(`unexpected ${operation}`);
    return answers[operation];
  });
  return {
    calls,
    admin: new UserAdministration({ request } as unknown as GraphQLClient),
  };
};

describe("find", () => {
  it("looks a uuid up by id", async () => {
    const { admin, calls } = client({
      DescribeAdminUserById: { olympus_users: [ROW] },
    });
    const found = await admin.find(ID);
    expect(found?.id).toBe(ID);
    expect(calls[0]?.variables).toEqual({ id: ID });
  });

  it("looks anything else up by normalized email", async () => {
    const { admin, calls } = client({
      DescribeAdminUserByEmail: { olympus_users: [ROW] },
    });
    // The casing an operator types should not have to match what is stored.
    await admin.find("  NEIL@Example.com ");
    expect(calls[0]?.operation).toBe("DescribeAdminUserByEmail");
    expect(calls[0]?.variables).toEqual({ email: "neil@example.com" });
  });

  it("returns the email as it is stored, not as it was searched for", async () => {
    const { admin } = client({
      DescribeAdminUserByEmail: { olympus_users: [ROW] },
    });
    expect((await admin.find("neil@example.com"))?.email).toBe(
      "Neil@Example.com",
    );
  });

  it("sorts roles, so two runs read the same", async () => {
    const { admin } = client({
      DescribeAdminUserById: { olympus_users: [ROW] },
    });
    expect((await admin.find(ID))?.roles).toEqual(["admin", "user"]);
  });

  it("is undefined when there is no match", async () => {
    const { admin } = client({
      DescribeAdminUserByEmail: { olympus_users: [] },
    });
    expect(await admin.find("nobody@example.com")).toBeUndefined();
  });
});

describe("require", () => {
  it("explains which user was not found", async () => {
    const { admin } = client({
      DescribeAdminUserByEmail: { olympus_users: [] },
    });
    await expect(admin.require("nobody@example.com")).rejects.toThrow(
      /no user matches nobody@example.com/,
    );
  });
});

describe("add", () => {
  const created = { insert_olympus_users_one: ROW };

  it("creates the user and their roles in one mutation", async () => {
    const { admin, calls } = client({
      DescribeAdminUserByEmail: { olympus_users: [] },
      CreateUser: created,
    });
    await admin.add({
      email: "neil@example.com",
      displayName: "Neil",
      roles: ["admin", "user"],
    });
    const create = calls.find((call) => call.operation === "CreateUser");
    expect(create?.variables).toEqual({
      email: "neil@example.com",
      displayName: "Neil",
      roles: [{ role: "admin" }, { role: "user" }],
    });
  });

  it("keeps the email as typed, since the generated column is the key", async () => {
    const { admin, calls } = client({
      DescribeAdminUserByEmail: { olympus_users: [] },
      CreateUser: created,
    });
    await admin.add({
      email: "  Neil@Example.com  ",
      displayName: "  Neil  ",
      roles: [],
    });
    const create = calls.find((call) => call.operation === "CreateUser");
    // Trimmed, because trailing space in an address is never meant; not
    // lowercased, because that is the person's own address.
    expect(create?.variables).toMatchObject({
      email: "Neil@Example.com",
      displayName: "Neil",
    });
  });

  it("refuses a second user with the same address in a different case", async () => {
    const { admin } = client({
      DescribeAdminUserByEmail: { olympus_users: [ROW] },
    });
    await expect(
      admin.add({
        email: "NEIL@example.com",
        displayName: "Neil Again",
        roles: [],
      }),
    ).rejects.toThrow(/already user/);
  });

  it("refuses something that is not an address", async () => {
    const { admin } = client({});
    await expect(
      admin.add({ email: "neil", displayName: "Neil", roles: [] }),
    ).rejects.toThrow(UserAdministrationError);
  });

  it("refuses an empty display name", async () => {
    const { admin } = client({});
    await expect(
      admin.add({ email: "neil@example.com", displayName: "   ", roles: [] }),
    ).rejects.toThrow(/display name/);
  });

  it("refuses a role whose case would make it a second role", async () => {
    const { admin } = client({});
    await expect(
      admin.add({
        email: "neil@example.com",
        displayName: "Neil",
        roles: ["Admin"],
      }),
    ).rejects.toThrow(/not role names/);
  });

  it("checks the roles before creating anything", async () => {
    const { admin, calls } = client({});
    await expect(
      admin.add({
        email: "neil@example.com",
        displayName: "Neil",
        roles: ["ok", "NOT ok"],
      }),
    ).rejects.toThrow(UserAdministrationError);
    // Not even the duplicate lookup: a bad role list is a typo, and a
    // half-done command is worse than none.
    expect(calls).toEqual([]);
  });
});

describe("setRoles", () => {
  const answered = {
    SetUserRoles: {
      delete_olympus_user_roles: { affected_rows: 2 },
      insert_olympus_user_roles: { affected_rows: 1 },
    },
  };

  it("deletes and inserts in one mutation, so there is no roleless moment", async () => {
    const { admin, calls } = client(answered);
    await admin.setRoles(ID, ["admin"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.variables).toEqual({
      userId: ID,
      roles: [{ userId: ID, role: "admin" }],
    });
  });

  it("de-duplicates and sorts what it was asked for", async () => {
    const { admin } = client(answered);
    expect(await admin.setRoles(ID, ["user", "admin", "user"])).toEqual([
      "admin",
      "user",
    ]);
  });

  it("clears them when asked for none", async () => {
    const { admin, calls } = client(answered);
    expect(await admin.setRoles(ID, [])).toEqual([]);
    expect(calls[0]?.variables).toEqual({ userId: ID, roles: [] });
  });

  it("refuses a bad role without deleting the good ones", async () => {
    const { admin, calls } = client({});
    await expect(admin.setRoles(ID, ["admin", "Ops"])).rejects.toThrow(
      /not role names/,
    );
    expect(calls).toEqual([]);
  });
});

describe("setDisabled", () => {
  it("disables and re-enables the same way", async () => {
    const { admin, calls } = client({
      SetUserDisabled: { update_olympus_users_by_pk: { id: ID } },
    });
    await admin.setDisabled(ID, true);
    await admin.setDisabled(ID, false);
    expect(calls.map((call) => call.variables)).toEqual([
      { userId: ID, disabled: true },
      { userId: ID, disabled: false },
    ]);
  });
});

describe("unlink", () => {
  it("reports how many identities it forgot", async () => {
    const { admin } = client({
      DeleteUserIdentity: {
        delete_olympus_user_identities: { affected_rows: 1 },
      },
    });
    expect(await admin.unlink(ID, "google")).toBe(1);
  });

  it("reports zero rather than failing when there was none", async () => {
    const { admin } = client({
      DeleteUserIdentity: {
        delete_olympus_user_identities: { affected_rows: 0 },
      },
    });
    expect(await admin.unlink(ID, "github")).toBe(0);
  });

  it("only forgets that one provider's identity", async () => {
    const { admin, calls } = client({
      DeleteUserIdentity: {
        delete_olympus_user_identities: { affected_rows: 1 },
      },
    });
    await admin.unlink(ID, "google");
    expect(calls[0]?.variables).toEqual({ userId: ID, provider: "google" });
  });
});

describe("list", () => {
  it("returns every user, roles sorted", async () => {
    const { admin } = client({ ListUsers: { olympus_users: [ROW] } });
    const all = await admin.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.roles).toEqual(["admin", "user"]);
    expect(all[0]?.identities).toEqual(ROW.identities);
  });

  it("is empty rather than failing when nobody exists", async () => {
    const { admin } = client({ ListUsers: { olympus_users: [] } });
    expect(await admin.list()).toEqual([]);
  });
});

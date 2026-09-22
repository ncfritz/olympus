import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConsoleAuth } from "../../src/auth/useConsoleAuth";
import {
  ControlShell,
  type ControlShellProps,
} from "../../src/shell/ControlShell";
import { ThemeModeProvider } from "../../src/theme/ThemeModeProvider";
import { testRegistry } from "../support/registry";

const authenticated: ConsoleAuth = {
  status: "authenticated",
  email: "neil@example.test",
  logout: async () => {},
  signInHref: (provider) => `/minerva/calendar/api/auth/login/${provider}`,
};

const renderShell = (props: Partial<ControlShellProps> = {}) =>
  render(
    <ThemeModeProvider>
      <ControlShell
        nav={testRegistry}
        current="minerva/calendar"
        auth={authenticated}
        {...props}
      >
        <p>the page</p>
      </ControlShell>
    </ThemeModeProvider>,
  );

const part = (container: HTMLElement, selector: string): HTMLElement => {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`no ${selector}`);
  return element;
};

const hrefs = (element: HTMLElement): (string | null)[] =>
  Array.from(element.querySelectorAll<HTMLAnchorElement>("a")).map((link) =>
    link.getAttribute("href"),
  );

describe("ControlShell", () => {
  it("shows the whole suite, grouped by property", () => {
    const { container } = renderShell();
    const text = part(container, ".ant-layout-sider").textContent ?? "";

    for (const label of [
      "Olympus",
      "Notifications",
      "CA",
      "Minerva",
      "Calendar",
    ]) {
      expect(text).toContain(label);
    }
  });

  it("links to the other consoles as documents, not routes", () => {
    const { container } = renderShell();

    expect(hrefs(part(container, ".ant-layout-sider"))).toEqual([
      "/olympus/notifications",
      "/olympus/ca",
      "/minerva/calendar",
    ]);
  });

  it("points at the suite's own origin when it is somewhere else", () => {
    const { container } = renderShell({
      origin: "https://control.olympus.ncfritz.net",
    });

    expect(hrefs(part(container, ".ant-layout-sider"))[0]).toBe(
      "https://control.olympus.ncfritz.net/olympus/notifications",
    );
  });

  it("marks the console it is", () => {
    const { container } = renderShell();

    expect(
      part(container, ".ant-layout-sider .ant-menu-item-selected").textContent,
    ).toContain("Calendar");
  });

  it("names the console and its property in the header", () => {
    renderShell();

    expect(screen.getByText("Minerva · Calendar")).toBeDefined();
  });

  it("still names a console the host's list leaves out of the sidebar", () => {
    const { container } = renderShell({
      nav: testRegistry.filter((property) => property.key === "olympus"),
    });

    expect(screen.getByText("Minerva · Calendar")).toBeDefined();
    expect(part(container, ".ant-layout-sider").textContent).not.toContain(
      "Calendar",
    );
  });

  it("shows the console's own pages, and which one is open", () => {
    const { container } = renderShell({
      tabs: [
        { key: "/", label: "Events" },
        { key: "/sync", label: "Sync" },
      ],
      activeTab: "/sync",
    });
    const header = part(container, ".ant-layout-header");

    expect(header.textContent).toContain("Events");
    expect(
      part(container, ".ant-layout-header .ant-menu-item-selected").textContent,
    ).toContain("Sync");
  });

  it("puts the console's own controls in the header", () => {
    const { container } = renderShell({
      actions: <button type="button">Settings</button>,
    });

    expect(part(container, ".ant-layout-header").textContent).toContain(
      "Settings",
    );
  });

  it("renders the page", () => {
    renderShell();

    expect(screen.getByText("the page")).toBeDefined();
  });

  it("asks for a session before showing any of it", () => {
    const { container } = renderShell({
      auth: { ...authenticated, status: "unauthenticated", email: undefined },
      signIn: [{ name: "google", label: "Sign in with Google" }],
    });

    expect(container.querySelector(".ant-layout-sider")).toBeNull();
    expect(screen.getByText("Sign in with Google").closest("a")).toHaveProperty(
      "pathname",
      "/minerva/calendar/api/auth/login/google",
    );
  });

  describe("as the suite's index, which is no console and has no session", () => {
    const renderIndex = () =>
      render(
        <ThemeModeProvider>
          <ControlShell nav={testRegistry}>
            <p>the index</p>
          </ControlShell>
        </ThemeModeProvider>,
      );

    it("shows the suite and the page", () => {
      const { container } = renderIndex();

      expect(hrefs(part(container, ".ant-layout-sider"))).toHaveLength(3);
      expect(screen.getByText("the index")).toBeDefined();
    });

    it("marks no console, and leaves the naming to the sider", () => {
      const { container } = renderIndex();

      expect(container.querySelector(".ant-menu-item-selected")).toBeNull();
      // The sider's wordmark already says it; the header would be saying
      // "Olympus Control" a second time.
      expect(part(container, ".ant-layout-header").textContent).not.toContain(
        "Olympus Control",
      );
    });

    it("offers no session menu", () => {
      const { container } = renderIndex();

      expect(part(container, ".ant-layout-header").textContent).not.toContain(
        "@",
      );
    });
  });

  it("waits rather than flashing a sign-in screen", () => {
    const { container } = renderShell({
      auth: { ...authenticated, status: "loading" },
    });

    expect(container.querySelector(".ant-spin")).not.toBeNull();
    expect(screen.queryByText("the page")).toBeNull();
  });
});

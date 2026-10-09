import { CalendarOutlined, SettingOutlined } from "@ant-design/icons";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleAuth } from "../../src/auth/useConsoleAuth";
import {
  ControlShell,
  type ControlShellProps,
} from "../../src/shell/ControlShell";
import type { ShellPage } from "../../src/shell/types";
import { ThemeModeProvider } from "../../src/theme/ThemeModeProvider";
import { testRegistry } from "../support/registry";

const authenticated: ConsoleAuth = {
  status: "authenticated",
  email: "neil@example.test",
  logout: async () => {},
  signInHref: (provider) => `/minerva/calendar/api/auth/login/${provider}`,
};

const pages: ShellPage[] = [
  {
    key: "/",
    label: "Accounts",
    icon: <CalendarOutlined />,
    href: "/minerva/calendar",
  },
  {
    key: "settings",
    label: "Settings",
    icon: <SettingOutlined />,
    children: [
      {
        key: "/sync",
        label: "Sync",
        icon: <SettingOutlined />,
        href: "/minerva/calendar/sync",
      },
    ],
  },
];

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

const siders = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(".ant-layout-sider"));

/** The console rail: the first sider, and the only one on the index. */
const rail = (container: HTMLElement): HTMLElement => {
  const [first] = siders(container);
  if (!first) throw new Error("no rail");
  return first;
};

const hrefs = (element: HTMLElement): (string | null)[] =>
  Array.from(element.querySelectorAll<HTMLAnchorElement>("a")).map((link) =>
    link.getAttribute("href"),
  );

describe("ControlShell", () => {
  describe("the console rail", () => {
    it("is the suite, flat: the index and every console", () => {
      const { container } = renderShell();

      expect(hrefs(rail(container))).toEqual([
        "/",
        "/olympus/notifications",
        "/olympus/ca",
        "/minerva/calendar",
      ]);
    });

    it("leaves the properties to the tooltips, having no room for them", () => {
      const { container } = renderShell();

      expect(rail(container).querySelector(".ant-menu-item-group")).toBeNull();
      expect(screen.getByLabelText("Minerva · Calendar")).toHaveProperty(
        "tagName",
        "A",
      );
    });

    it("points at the suite's own origin when it is somewhere else", () => {
      const { container } = renderShell({
        origin: "https://control.olympus.ncfritz.net",
      });

      expect(hrefs(rail(container))).toContain(
        "https://control.olympus.ncfritz.net/olympus/notifications",
      );
    });

    it("marks the console it is", () => {
      const { container } = renderShell();

      expect(
        part(rail(container), ".ant-menu-item-selected").getAttribute(
          "aria-label",
        ) ??
          part(rail(container), ".ant-menu-item-selected a")?.getAttribute(
            "aria-label",
          ),
      ).toBe("Minerva · Calendar");
    });

    it("does not collapse: it is the one fixed thing on the screen", () => {
      const { container } = renderShell({ pages });

      expect(rail(container).classList).toContain("ant-layout-sider-collapsed");
      expect(
        rail(container).querySelector(".ant-layout-sider-trigger"),
      ).toBeNull();
    });
  });

  describe("the console's own pages", () => {
    const pagesSider = (container: HTMLElement): HTMLElement => {
      const second = siders(container)[1];
      if (!second) throw new Error("no pages sider");
      return second;
    };

    const collapse = (container: HTMLElement) => {
      fireEvent.click(screen.getByLabelText("Collapse the page list"));
      return pagesSider(container);
    };

    it("are a sider of their own, beside the rail", () => {
      const { container } = renderShell({ pages, activePage: "/" });

      expect(pagesSider(container).textContent).toContain("Accounts");
      expect(
        part(pagesSider(container), ".ant-menu-item-selected").textContent,
      ).toContain("Accounts");
    });

    it("is not there at all for a console with none", () => {
      const { container } = renderShell();

      expect(siders(container)).toHaveLength(1);
    });

    it("collapses to a rail rather than out of view", () => {
      const { container } = renderShell({ pages });
      const sider = collapse(container);

      expect(sider.classList).toContain("ant-layout-sider-collapsed");
      expect(sider.style.width).toBe("80px");
    });

    it("still links every page from the rail", () => {
      const { container } = renderShell({ pages });

      expect(hrefs(collapse(container))).toEqual(["/minerva/calendar"]);
    });

    it("offers the way back", () => {
      const { container } = renderShell({ pages });
      collapse(container);

      fireEvent.click(screen.getByLabelText("Expand the page list"));

      expect(pagesSider(container).classList).not.toContain(
        "ant-layout-sider-collapsed",
      );
    });

    it("lets the console route its own plain clicks", () => {
      const onNavigate = vi.fn();
      renderShell({ pages, onNavigate });

      fireEvent.click(screen.getByText("Accounts"));

      expect(onNavigate).toHaveBeenCalledWith("/minerva/calendar");
    });

    it("leaves a new-tab click to the browser", () => {
      const onNavigate = vi.fn();
      renderShell({ pages, onNavigate });

      fireEvent.click(screen.getByText("Accounts"), { metaKey: true });

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe("the header", () => {
    const header = (container: HTMLElement) =>
      part(container, ".ant-layout-header");

    it("says where you are, down to the page", () => {
      const { container } = renderShell({ pages, activePage: "/sync" });

      expect(header(container).textContent).toContain("Control");
      expect(header(container).textContent).toContain("Minerva");
      expect(header(container).textContent).toContain("Calendar");
      expect(header(container).textContent).toContain("Settings");
      expect(header(container).textContent).toContain("Sync");
    });

    it("links the suite and the console, but not the property", () => {
      const { container } = renderShell();

      expect(hrefs(header(container))).toEqual(["/", "/minerva/calendar"]);
    });

    it("still names a console the host's list leaves out of the rail", () => {
      const { container } = renderShell({
        nav: testRegistry.filter((property) => property.key === "olympus"),
      });

      expect(header(container).textContent).toContain("Calendar");
      expect(rail(container).textContent).not.toContain("Calendar");
    });

    it("holds no navigation of its own", () => {
      const { container } = renderShell({ pages });

      expect(header(container).querySelector(".ant-menu")).toBeNull();
      expect(
        header(container).querySelector('[aria-label*="page list"]'),
      ).toBeNull();
    });

    it("puts the console's own controls in it", () => {
      const { container } = renderShell({
        actions: <button type="button">Settings</button>,
      });

      expect(header(container).textContent).toContain("Settings");
    });

    it("shows the suite's wordmark when it is given one", () => {
      const { container } = renderShell({
        logo: <img src="/header.png" alt="Olympus" height={64} />,
      });

      expect(
        part(container, ".ant-layout-header img").getAttribute("alt"),
      ).toBe("Olympus");
    });
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

      expect(hrefs(rail(container))).toHaveLength(4);
      expect(screen.getByText("the index")).toBeDefined();
    });

    it("marks itself in the rail, and no console", () => {
      const { container } = renderIndex();

      expect(
        part(rail(container), ".ant-menu-item-selected a").getAttribute(
          "aria-label",
        ),
      ).toBe("Olympus Control");
    });

    it("is the whole of the trail", () => {
      const { container } = renderIndex();

      expect(
        part(container, ".ant-layout-header").textContent?.trim(),
      ).toContain("Control");
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

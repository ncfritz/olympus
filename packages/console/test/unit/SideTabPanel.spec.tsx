import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SideTabPanel } from "../../src/shell/SideTabPanel";
import styles from "../../src/shell/SideTabPanel.module.css";

const panel = (defaultExpanded?: boolean) => (
  <SideTabPanel
    panelId="test.side"
    width={400}
    defaultExpanded={defaultExpanded}
    tabs={[
      { key: "one", label: <span>One</span>, children: <p>First tab</p> },
      { key: "two", label: <span>Two</span>, children: <p>Second tab</p> },
    ]}
  >
    <p>The page</p>
  </SideTabPanel>
);

const root = (container: HTMLElement) =>
  container.querySelector(`.${styles.panel}`)!;

describe("SideTabPanel", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the page beside a closed panel by default", () => {
    const { container } = render(panel());
    expect(screen.getByText("The page")).toBeTruthy();
    expect(root(container).classList.contains(styles.collapsed)).toBe(true);
  });

  it("opens on a tab, and keeps that it is open", () => {
    const { container, unmount } = render(panel());
    fireEvent.click(screen.getByText("Two"));
    expect(root(container).classList.contains(styles.expanded)).toBe(true);
    expect(window.localStorage.getItem("olympus:sidePanel:test.side")).toBe(
      "true",
    );
    unmount();
    const again = render(panel());
    expect(root(again.container).classList.contains(styles.expanded)).toBe(
      true,
    );
  });

  it("closes from the bar across its top", () => {
    const { container } = render(panel(true));
    fireEvent.click(container.querySelector(".ant-layout-sider-trigger")!);
    expect(root(container).classList.contains(styles.collapsed)).toBe(true);
    expect(window.localStorage.getItem("olympus:sidePanel:test.side")).toBe(
      "false",
    );
  });
});

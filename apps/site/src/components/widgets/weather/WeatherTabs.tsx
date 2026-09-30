import { useRef } from "react";
import styles from "./WeatherWidget.module.css";

export type WeatherView = "forecast" | "stations";

const TABS: { value: WeatherView; label: string }[] = [
  { value: "forecast", label: "Forecast" },
  { value: "stations", label: "Stations" },
];

/** The id of a view's tab, which its panel is labelled by. */
export const tabId = (view: WeatherView) => `weather-tab-${view}`;
/** The id of a view's panel, which its tab controls. */
export const panelId = (view: WeatherView) => `weather-panel-${view}`;

export interface WeatherTabsProps {
  /** Undefined draws the bar with no tabs (signed out, loading). */
  view?: WeatherView;
  onChange?: (view: WeatherView) => void;
  /** Right-aligned beside the tabs: the location menu. */
  extra?: React.ReactNode;
}

/**
 * The widget's tab bar: the tabs at the left sitting on the blue rule,
 * anything else at the right. A WAI-ARIA tab list: the chosen tab is the
 * one in the tab order, and the arrow keys, Home and End move between
 * them.
 */
const WeatherTabs: React.FunctionComponent<WeatherTabsProps> = ({
  view,
  onChange,
  extra,
}: WeatherTabsProps) => {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (event: React.KeyboardEvent, index: number) => {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? TABS.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onChange?.(TABS[next].value);
    refs.current[TABS[next].value]?.focus();
  };

  return (
    <div className={styles.tabBar}>
      {view && (
        <div role="tablist" aria-label="Weather" className={styles.tabs}>
          {TABS.map((tab, index) => {
            const selected = tab.value === view;
            return (
              <button
                key={tab.value}
                ref={(element) => {
                  refs.current[tab.value] = element;
                }}
                type="button"
                role="tab"
                id={tabId(tab.value)}
                aria-selected={selected}
                aria-controls={panelId(tab.value)}
                tabIndex={selected ? 0 : -1}
                className={`${styles.tab} ${selected ? styles.tabSelected : ""}`}
                onClick={() => onChange?.(tab.value)}
                onKeyDown={(event) => move(event, index)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
      {extra && <div className={styles.tabExtra}>{extra}</div>}
    </div>
  );
};

export default WeatherTabs;

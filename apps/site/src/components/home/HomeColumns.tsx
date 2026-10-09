import { Splitter } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import {
  DEFAULT_HOME_LAYOUT,
  HOME_LAYOUT_KEY,
  type HomeLayout,
  parseHomeLayout,
  toPercentages,
} from "../../utils/homeLayout";
import { loadFromLocalStorage, storeToLocalStorage } from "../../utils/storage";
import styles from "./HomeColumns.module.css";

export interface HomeColumnsProps {
  /** Exactly three: left, middle, right. */
  children: [ReactNode, ReactNode, ReactNode];
}

const COLLAPSIBLE = {
  start: true,
  end: true,
  showCollapsibleIcon: "auto",
} as const;

/**
 * Three resizable, collapsible columns. Their widths and collapsed state
 * are kept in this browser's local storage, as percentages; a later change
 * moves them to the user's settings.
 */
const HomeColumns: React.FunctionComponent<HomeColumnsProps> = ({
  children,
}: HomeColumnsProps) => {
  const [layout, setLayout] = useState<HomeLayout>(DEFAULT_HOME_LAYOUT);

  // After mounting, not while rendering: the server has no local storage,
  // and reading it during the first render would not match the page it sent.
  useEffect(() => {
    setLayout(
      parseHomeLayout(loadFromLocalStorage<unknown>(HOME_LAYOUT_KEY, null)),
    );
  }, []);

  const save = (next: HomeLayout) => {
    setLayout(next);
    try {
      storeToLocalStorage(HOME_LAYOUT_KEY, next);
    } catch {
      // Storage full or blocked: the layout still applies to this visit.
    }
  };

  return (
    <Splitter
      className={styles.splitter}
      onResize={(sizes) =>
        setLayout((current) => ({ ...current, sizes: toPercentages(sizes) }))
      }
      onResizeEnd={(sizes) =>
        save({
          sizes: toPercentages(sizes),
          collapsed: sizes.map((size) => size === 0),
        })
      }
      onCollapse={(collapsed, sizes) =>
        save({ sizes: toPercentages(sizes), collapsed })
      }
    >
      {children.map((child, index) => (
        <Splitter.Panel
          key={index}
          className={styles.column}
          size={layout.sizes[index]}
          collapsible={COLLAPSIBLE}
        >
          {child}
        </Splitter.Panel>
      ))}
    </Splitter>
  );
};

export default HomeColumns;

import { Flex, Typography } from "antd";
import type { ReactNode } from "react";
import styles from "./Dashboard.module.css";

/**
 * One of the dashboard's graphs: a box in the row of graphs, divided from
 * its neighbours by a border rather than set apart as a card, its title
 * and controls above what it draws.
 */
export function GraphBox({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.box} aria-label={title}>
      <Flex justify="space-between" align="center" gap="small" wrap>
        <Typography.Text strong className={styles.boxTitle}>
          {title}
        </Typography.Text>
        {extra}
      </Flex>
      {children}
    </section>
  );
}

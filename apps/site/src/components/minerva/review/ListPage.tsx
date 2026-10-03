import React from "react";
import styles from "./Lists.module.css";

export interface ListPageProps {
  /** Above the page: the breadcrumbs. */
  breadcrumbs: React.ReactNode;
  title: string;
  subtitle: string;
  /** Beside the title: links to the reviews. */
  actions?: React.ReactNode;
  /** The summary bar under the title. */
  summary: React.ReactNode;
  /** The calendar sider, at the right. */
  sider: React.ReactNode;
  /** The rows. */
  children: React.ReactNode;
}

/**
 * A review list as design.md lays it out: the period's title and summary
 * over its rows, and a calendar in a 400 px sider at the right.
 */
const ListPage: React.FunctionComponent<ListPageProps> = ({
  breadcrumbs,
  title,
  subtitle,
  actions,
  summary,
  sider,
  children,
}) => (
  <>
    {breadcrumbs}
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            <span className={styles.subtitle}>{subtitle}</span>
          </div>
          {actions}
        </div>
        <div className={styles.summary}>{summary}</div>
        {children}
      </main>
      <aside className={styles.sider} aria-label={"Calendar"}>
        {sider}
      </aside>
    </div>
  </>
);

export default ListPage;

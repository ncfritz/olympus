"use client";

import { BellOutlined, CopyOutlined, PlusOutlined } from "@ant-design/icons";
import { SideTabPanel } from "@ncfritz/olympus-console";
import {
  Badge,
  Button,
  Flex,
  message,
  Skeleton,
  Tabs,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  countsOf,
  failureOf,
  needsALook,
  ORDER_DAYS,
  reasonOf,
} from "@/lib/acme";
import {
  useAcmeClients,
  useAcmeOrders,
  useCurrentUser,
} from "@/lib/api/queries";
import { timeUntil } from "@/lib/dashboard";
import { Count, CountStrip } from "../CountStrip";
import { ErrorAlert } from "../ErrorAlert";
import styles from "./Acme.module.css";
import { AcmeGraphs } from "./AcmeGraphs";
import { ClientList } from "./ClientList";
import { NeedsALook } from "./NeedsALook";
import { RenewalTimeline } from "./RenewalTimeline";

/** The tabs, by `?view=`. */
const VIEWS = ["clients", "timeline", "activity"] as const;
type View = (typeof VIEWS)[number];

/** The side panel's width, open. */
const PANEL_WIDTH = 420;

/**
 * ACME (ADR 0020, ACME): the clients that get and renew their own
 * certificates, each from a credential (External Account Binding) naming
 * what it may request. Their counts across the top, the month's orders
 * graphed beneath, then the clients and their renewal windows in tabs; what
 * needs a look in a side panel. A client is opened in the list from `?id=`.
 */
export function AcmePage() {
  const clients = useAcmeClients();
  const orders = useAcmeOrders(ORDER_DAYS);
  const { isAdmin } = useCurrentUser();
  const [messages, messageHolder] = message.useMessage();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "clients";
  const open = params.get("id") ?? undefined;
  const go = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };
  const onOpen = (id?: string) => go({ id });
  const reveal = (id: string) => go({ view: "clients", id });

  // A client opened from elsewhere (the panel, the timeline, a link): in view.
  useEffect(() => {
    if (!open || view !== "clients") return;
    document
      .querySelector(`[data-row-key="${CSS.escape(open)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, view, clients.data]);

  const directoryUrl = clients.data?.directoryUrl;
  const copyDirectory = async () => {
    if (!directoryUrl) return;
    await navigator.clipboard.writeText(directoryUrl);
    void messages.success("Directory URL copied");
  };

  const header = (
    <Flex
      justify="space-between"
      align="center"
      wrap
      gap="middle"
      className={styles.header}
    >
      <div>
        <Typography.Title level={3} className={styles.title}>
          ACME
        </Typography.Title>
        <Typography.Text type="secondary">
          ACME clients get and renew their own certificates: each starts from a
          credential (External Account Binding) naming what it may request
        </Typography.Text>
      </div>
      <Flex gap="small" wrap>
        <Tooltip title={directoryUrl}>
          <Button
            icon={<CopyOutlined />}
            disabled={!directoryUrl}
            onClick={copyDirectory}
          >
            Copy directory URL
          </Button>
        </Tooltip>
        {isAdmin && (
          <Link href="/acme/new">
            <Button type="primary" icon={<PlusOutlined />}>
              New client
            </Button>
          </Link>
        )}
      </Flex>
    </Flex>
  );

  if (!clients.data || !orders.data) {
    const error = clients.error ?? orders.error;
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.padded}>
          <ErrorAlert error={error} title="ACME could not be read" />
          {!error && <Skeleton active />}
        </div>
      </div>
    );
  }

  const now = Date.parse(clients.data.asOf);
  const all = clients.data.clients;
  const recent = orders.data.orders;
  const counts = countsOf(all, recent, now);
  const look = needsALook(all, recent, now);
  const errors = look.some((item) => item.severity === "error");
  const firstFailing = counts.failing[0];
  const failingWhy =
    firstFailing?.lastOrder && failureOf(firstFailing.lastOrder);
  const next = counts.next;
  const nextIn = next
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(next.certificate.renewalStart) - now) / 86_400_000,
        ),
      )
    : undefined;

  return (
    <SideTabPanel
      panelId="harpocrates.acme"
      width={PANEL_WIDTH}
      className={`${styles.page} ${styles.fit}`}
      tabs={[
        {
          key: "look",
          label: (
            <Tooltip title="Needs a look" placement="left">
              <span aria-label="Needs a look">
                <Badge
                  count={look.filter((i) => i.severity !== "info").length}
                  size="small"
                  color={errors ? "red" : "orange"}
                >
                  <BellOutlined />
                </Badge>
              </span>
            </Tooltip>
          ),
          children: <NeedsALook items={look} onOpen={reveal} />,
        },
      ]}
    >
      {messageHolder}
      {header}
      <CountStrip>
        <Count
          title="Clients"
          value={counts.clients}
          note={`${counts.bound} bound · ${counts.waiting} waiting`}
        />
        <Count
          title="Certificates held"
          value={counts.held}
          note="Via ACME, valid"
        />
        <Count
          title={`Orders, ${ORDER_DAYS} days`}
          value={counts.orders}
          note={`${counts.issued} issued · ${counts.failed} failed`}
        />
        <Count
          title="Failing"
          value={counts.failing.length}
          note={
            firstFailing
              ? `${firstFailing.credential.label}${failingWhy ? `: ${reasonOf(failingWhy.type).toLowerCase()}` : ": past its window"}`
              : "None"
          }
        />
        <Count
          title="Next renewal"
          value={nextIn === undefined ? "—" : nextIn === 0 ? "Now" : nextIn}
          suffix={nextIn ? "d" : undefined}
          note={
            next
              ? `${next.client.credential.label}, by its renewal window${nextIn ? `: ${timeUntil(next.certificate.renewalStart, now)}` : ""}`
              : "Nothing held"
          }
        />
      </CountStrip>
      <Tabs
        className={styles.tabs}
        activeKey={view}
        onChange={(key) => go({ view: key })}
        items={[
          {
            key: "clients",
            label: "Clients",
            children: (
              <ClientList
                clients={all}
                orders={recent}
                now={now}
                isAdmin={isAdmin}
                open={open}
                onOpen={onOpen}
              />
            ),
          },
          {
            key: "timeline",
            label: "Timeline",
            children: (
              <RenewalTimeline clients={all} now={now} onOpen={reveal} />
            ),
          },
          {
            // The graphs have a tab of their own, so the lists keep the
            // page's height and the page never scrolls.
            key: "activity",
            label: "Activity",
            children: (
              <div className={styles.activity}>
                <AcmeGraphs orders={recent} now={now} />
              </div>
            ),
          },
        ]}
      />
    </SideTabPanel>
  );
}

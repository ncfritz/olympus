"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, message, Modal, Skeleton, Tabs, Typography } from "antd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCurrentUser, useSshCertificates } from "@/lib/api/queries";
import type { SshCertificateType } from "@/lib/api/types";
import { timeUntil } from "@/lib/dashboard";
import { formatDate } from "@/lib/labels";
import { countsOf, holderOf } from "@/lib/sshCertificates";
import { Count, CountStrip } from "../../CountStrip";
import { ErrorAlert } from "../../ErrorAlert";
import { IssueSshCertificateForm } from "../IssueSshCertificateForm";
import { CertificateList, type Filter } from "./CertificateList";
import { CertificateTimeline } from "./CertificateTimeline";
import styles from "./SshCertificates.module.css";

/** The tabs, by `?view=`. */
const VIEWS = ["list", "timeline"] as const;
type View = (typeof VIEWS)[number];

/**
 * The SSH certificates (ADR 0035): their counts across the top, then the
 * List (filtered, each opened to what it says, its file and revoking it,
 * from `?id=`) and the Timeline (people's over two days, hosts' over a
 * month). The newest 500 are read. An admin issues a user certificate for
 * any mapped identity, or a host's first certificate.
 */
export function SshCertificatesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [messages, messageHolder] = message.useMessage();
  const { isAdmin } = useCurrentUser();
  const { data, error } = useSshCertificates({});
  const [issuing, setIssuing] = useState<SshCertificateType>();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "list";
  const open = params.get("id") ?? undefined;
  // A certificate opened by link may be expired or revoked: show everything.
  const [filter, setFilter] = useState<Filter>(open ? "all" : "valid");
  const [now] = useState(() => Date.now());

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
          SSH certificates
        </Typography.Title>
        <Typography.Text type="secondary">
          Who may log in, and which hosts are who they say. People get their own
          on <Link href="/ssh/mine">My SSH certificate</Link>
        </Typography.Text>
      </div>
      {isAdmin && (
        <Flex gap="small" wrap>
          <Link href="/ssh/principals">
            <Button>Principals</Button>
          </Link>
          <Button icon={<PlusOutlined />} onClick={() => setIssuing("user")}>
            User certificate
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIssuing("host")}
          >
            Host certificate
          </Button>
        </Flex>
      )}
    </Flex>
  );

  const modal = (
    <Modal
      open={Boolean(issuing)}
      title={
        issuing === "host"
          ? "Issue a host certificate"
          : "Issue a user certificate"
      }
      footer={null}
      destroyOnHidden
      onCancel={() => setIssuing(undefined)}
    >
      {issuing && (
        <IssueSshCertificateForm
          type={issuing}
          forWhom="anyone"
          onIssued={(certificate) => {
            setIssuing(undefined);
            void messages.success("Issued");
            setFilter("all");
            go({ view: "list", id: certificate.id });
          }}
        />
      )}
    </Modal>
  );

  if (!data) {
    return (
      <div className={styles.page}>
        {messageHolder}
        {header}
        <div className={styles.padded}>
          <ErrorAlert
            error={error}
            title="The SSH certificates could not be read"
          />
          {!error && <Skeleton active />}
        </div>
        {modal}
      </div>
    );
  }

  const counts = countsOf(data, now);
  const last = counts.lastRevoked;

  return (
    <div className={styles.page}>
      {messageHolder}
      {header}
      <CountStrip>
        <Count
          title="Valid now"
          value={counts.current}
          note={`${counts.users} user · ${counts.hosts} host`}
        />
        <Count
          title="Expiring, an hour"
          value={counts.expiringSoon}
          note="They sign again"
        />
        <Count
          title="Issued today"
          value={counts.today}
          note={`${counts.todayPeople} people · ${counts.todayRenewals} renewals`}
        />
        <Count
          title="Hosts renewing"
          value={`${counts.hostsRenewing} of ${counts.hostCount}`}
          note={
            counts.nextRenewal
              ? `Next: ${counts.nextRenewal.host}, ${counts.nextRenewal.at <= now ? "now" : `in ${timeUntil(new Date(counts.nextRenewal.at).toISOString(), now)}`}`
              : "No host certificate yet"
          }
        />
        <Count
          title="In the KRLs"
          value={counts.inKrl}
          note={
            last
              ? `Last revoked: ${holderOf(last)}, ${formatDate(last.revokedAt)}`
              : "None revoked"
          }
        />
        <Count
          title="People with one"
          value={counts.people}
          note={`As ${counts.principals} principal${counts.principals === 1 ? "" : "s"}`}
        />
      </CountStrip>
      <Tabs
        className={styles.tabs}
        activeKey={view}
        onChange={(key) => go({ view: key })}
        items={[
          {
            key: "list",
            label: "List",
            children: (
              <CertificateList
                certificates={data}
                now={now}
                canRevoke
                filter={filter}
                onFilter={setFilter}
                open={open}
                onOpen={(id) => go({ id })}
              />
            ),
          },
          {
            key: "timeline",
            label: "Timeline",
            children: (
              <CertificateTimeline
                certificates={data}
                now={now}
                onOpen={(id) => {
                  setFilter("all");
                  go({ view: "list", id });
                }}
              />
            ),
          },
        ]}
      />
      {modal}
    </div>
  );
}

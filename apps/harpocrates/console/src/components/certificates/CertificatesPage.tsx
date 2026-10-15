"use client";

import { ImportOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Skeleton, Tabs, Typography } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCertificateLineages,
  useCurrentUser,
  useIssuers,
} from "@/lib/api/queries";
import { countsOf } from "@/lib/lineages";
import { Count, CountStrip } from "../CountStrip";
import { ErrorAlert } from "../ErrorAlert";
import { ImportLeafModal } from "../imports/ImportLeafModal";
import styles from "./Certificates.module.css";
import { LineageGraphs } from "./LineageGraphs";
import { LineageList } from "./LineageList";
import { LineageTimeline } from "./LineageTimeline";

/** The tabs, by `?view=`. */
const VIEWS = ["certificates", "timeline"] as const;
type View = (typeof VIEWS)[number];

/**
 * The certificates: each subject's lineage, its newest version what it
 * holds now and the rest beneath it. Their counts across the top; beneath,
 * the list (alerts, graphs, filters) and the timeline. One certificate at
 * a time on its own page; an old link's `?certificateId=` goes there.
 */
export function CertificatesPage() {
  const { data, error, isLoading } = useCertificateLineages();
  const { data: issuers } = useIssuers();
  const { isAdmin } = useCurrentUser();
  const [importing, setImporting] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View =
    VIEWS.find((v) => v === params.get("view")) ?? "certificates";
  const open = params.get("certificateId") ?? undefined;
  // Links from before the certificate's page: send them there.
  useEffect(() => {
    if (open) router.replace(`/certificate?id=${encodeURIComponent(open)}`);
  }, [open, router]);
  const go = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const onOpen = (certificateId: string) =>
    router.push(`/certificate?id=${encodeURIComponent(certificateId)}`);

  const lineages = data?.lineages ?? [];
  const now = data ? Date.parse(data.asOf) : 0;
  const counts = countsOf(lineages, now);

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
          Certificates
        </Typography.Title>
        <Typography.Text type="secondary">
          {data
            ? `${counts.held} held now, ${counts.versions} issued in all: each certificate's newest version, its others beneath it`
            : "Each certificate's newest version, its others beneath it"}
        </Typography.Text>
      </div>
      <Flex gap="small">
        <Button
          icon={<ImportOutlined />}
          disabled={!isAdmin}
          onClick={() => setImporting(true)}
        >
          Import
        </Button>
        <ImportLeafModal open={importing} onClose={() => setImporting(false)} />
        <Link href="/certificates/new">
          <Button type="primary" icon={<PlusOutlined />}>
            Issue
          </Button>
        </Link>
      </Flex>
    </Flex>
  );

  if (error || isLoading || !data) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.padded}>
          <ErrorAlert
            error={error}
            title="The certificates could not be read"
          />
          {!error && <Skeleton active />}
        </div>
      </div>
    );
  }

  const renewed = [
    counts.renewedBy.acme && `ACME ${counts.renewedBy.acme}`,
    counts.renewedBy.mtls && `mTLS ${counts.renewedBy.mtls}`,
    counts.renewedBy["deploy-target"] &&
      `deploy ${counts.renewedBy["deploy-target"]}`,
    counts.renewedBy.person && `by hand ${counts.renewedBy.person}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.page}>
      {header}
      <CountStrip>
        <Count
          title="Held now"
          value={counts.held}
          note={`${counts.versions} versions issued`}
        />
        <Count
          title="Renew this month"
          value={counts.thisMonth}
          note={`${counts.thisMonthThemselves} themselves, ${counts.thisMonth - counts.thisMonthThemselves} by a person`}
        />
        <Count
          title="Need a person"
          value={counts.needPerson}
          note={`${counts.failing} failing · ${counts.manual} manual`}
        />
        <Count
          title="Renewed, 30 days"
          value={counts.renewed}
          note={renewed || undefined}
        />
        <Count
          title="Expired or revoked"
          value={counts.ended}
          note="Kept a year"
        />
      </CountStrip>
      <Tabs
        className={styles.tabs}
        activeKey={view}
        onChange={(key) => go({ view: key })}
        items={[
          {
            key: "certificates",
            label: "Certificates",
            children: (
              <>
                <LineageGraphs lineages={lineages} now={now} />
                <LineageList
                  lineages={lineages}
                  issuers={issuers ?? []}
                  now={now}
                  issuerId={params.get("issuerId") ?? undefined}
                  onOpen={onOpen}
                />
              </>
            ),
          },
          {
            key: "timeline",
            label: "Timeline",
            children: (
              <LineageTimeline
                lineages={lineages}
                issuers={issuers ?? []}
                now={now}
                onOpen={onOpen}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

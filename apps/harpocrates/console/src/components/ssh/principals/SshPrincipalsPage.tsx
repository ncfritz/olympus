"use client";

import { HistoryOutlined, PlusOutlined } from "@ant-design/icons";
import { SideTabPanel } from "@ncfritz/olympus-console";
import {
  AutoComplete,
  Button,
  Flex,
  Form,
  message,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import {
  isSshCertificateKey,
  KEYS,
  usePrincipals,
  useSshCertificates,
  useSshPrincipalChanges,
  useSshPrincipals,
} from "@/lib/api/queries";
import { timeSince } from "@/lib/dashboard";
import {
  changesOf,
  countsOf,
  PRIVILEGED,
  type ReviewItem,
  reviewOf,
  rowsOf,
  unmappedOf,
} from "@/lib/sshPrincipals";
import { Count, CountStrip } from "../../CountStrip";
import { ErrorAlert } from "../../ErrorAlert";
import { Changes } from "./Changes";
import { MappingList, PRINCIPAL } from "./MappingList";
import { Review } from "./Review";
import styles from "./SshPrincipals.module.css";

/** The tabs, by `?view=`. */
const VIEWS = ["people", "review"] as const;
type View = (typeof VIEWS)[number];

/** The side panel's width, open. */
const PANEL_WIDTH = 380;

interface Values {
  identity: string;
  principals: string[];
}

/**
 * Who may log in as whom (ADR 0035): each Olympus person, by their email,
 * mapped to the Unix accounts their user certificates may carry. Counts
 * across the top; then People (each mapping, edited in place, beside
 * their certificates) and To Review (grants worth a look); the mappings'
 * changes in a side panel. Changing a mapping changes only certificates
 * signed after.
 */
export function SshPrincipalsPage() {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View = VIEWS.find((v) => v === params.get("view")) ?? "people";
  const { data: mappings, error } = useSshPrincipals();
  const { data: certificates } = useSshCertificates({ type: "user" });
  const { data: people } = usePrincipals();
  const { data: events } = useSshPrincipalChanges();
  const [busy, setBusy] = useState<string>();
  const [failure, setFailure] = useState<unknown>();
  const [mapping, setMapping] = useState<string | true>();
  const [form] = Form.useForm<Values>();
  const [now] = useState(() => Date.now());

  const rows = useMemo(
    () => rowsOf(mappings ?? [], certificates ?? [], now),
    [mappings, certificates, now],
  );
  const unmapped = useMemo(
    () => unmappedOf([...(people?.values() ?? [])], mappings ?? []),
    [people, mappings],
  );
  const changes = useMemo(() => changesOf(events ?? []), [events]);
  const review = useMemo(
    () => reviewOf(rows, changes, now),
    [rows, changes, now],
  );

  const refresh = () =>
    Promise.all([
      mutate(KEYS.sshPrincipals),
      mutate("/audit/events?subjectType=ssh-identity"),
      mutate(isSshCertificateKey),
    ]);

  const set = async (identity: string, principals: string[], done: string) => {
    setBusy(identity);
    try {
      unwrap(
        await apiClient.PUT("/v1/ssh/principals/{identity}", {
          params: { path: { identity } },
          body: { principals },
        }),
      );
      setFailure(undefined);
      setMapping(undefined);
      await refresh();
      void messages.success(done);
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  /** Removes grants from review: each person's principals, together. */
  const remove = async (items: ReviewItem[]) => {
    setBusy("review");
    try {
      const byPerson = new Map<string, ReviewItem[]>();
      for (const item of items) {
        byPerson.set(item.identity, [
          ...(byPerson.get(item.identity) ?? []),
          item,
        ]);
      }
      for (const [identity, grants] of byPerson) {
        const row = rows.find((r) => r.identity === identity);
        if (!row) continue;
        const all = grants.some((g) => !g.principal);
        const gone = new Set(grants.map((g) => g.principal));
        unwrap(
          await apiClient.PUT("/v1/ssh/principals/{identity}", {
            params: { path: { identity } },
            body: {
              principals: all ? [] : row.principals.filter((p) => !gone.has(p)),
            },
          }),
        );
      }
      setFailure(undefined);
      await refresh();
      void messages.success(
        `${items.length} grant${items.length === 1 ? "" : "s"} removed`,
      );
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  const go = (next: View) => {
    const query = new URLSearchParams(params.toString());
    query.set("view", next);
    router.replace(`${pathname}?${query}`, { scroll: false });
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
          SSH principals
        </Typography.Title>
        <Typography.Text type="secondary">
          Who may log in as whom: each person, by their email, mapped to the
          accounts their user certificates may carry
        </Typography.Text>
      </div>
      <Flex gap="small" wrap>
        <Link href="/ssh/certificates?view=list">
          <Button>Their certificates</Button>
        </Link>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setMapping(true);
          }}
        >
          Map a person
        </Button>
      </Flex>
    </Flex>
  );

  const modal = (
    <Modal
      open={Boolean(mapping)}
      title="Map a person"
      okText="Map"
      confirmLoading={Boolean(busy) && busy !== "review"}
      destroyOnHidden
      onCancel={() => setMapping(undefined)}
      onOk={async () => {
        const { identity, principals } = await form.validateFields();
        await set(
          identity.trim().toLowerCase(),
          principals,
          `${identity} may log in as ${principals.join(", ")}`,
        );
      }}
    >
      <Form<Values>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{
          identity: typeof mapping === "string" ? mapping : undefined,
          principals: [],
        }}
      >
        <Form.Item
          name="identity"
          label="Person"
          extra="Their Olympus email: what they sign in with."
          rules={[
            { required: true, type: "email", message: "An email address" },
          ]}
        >
          <AutoComplete
            options={unmapped.map((e) => ({ value: e }))}
            placeholder="someone@ncfritz.net"
          />
        </Form.Item>
        <Form.Item
          name="principals"
          label="May log in as"
          extra={`Unix account names. ${[...PRIVILEGED].join(", ")} are privileged: full control of a host.`}
          rules={[
            { required: true, type: "array", min: 1, message: "At least one" },
            {
              validator: (_, value: string[] = []) =>
                value.every((p) => PRINCIPAL.test(p))
                  ? Promise.resolve()
                  : Promise.reject(new Error("Not an account name")),
            },
          ]}
        >
          <Select mode="tags" open={false} tokenSeparators={[",", " "]} />
        </Form.Item>
      </Form>
      <ErrorAlert error={failure} />
    </Modal>
  );

  if (!mappings) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.padded}>
          <ErrorAlert error={error} title="The mappings could not be read" />
          {!error && <Skeleton active />}
        </div>
      </div>
    );
  }

  const counts = countsOf(rows, unmapped, review, changes);

  return (
    <SideTabPanel
      panelId="harpocrates.ssh-principals"
      width={PANEL_WIDTH}
      className={styles.page}
      tabs={[
        {
          key: "changes",
          label: (
            <Tooltip title="Changes" placement="left">
              <span aria-label="Changes">
                <HistoryOutlined />
              </span>
            </Tooltip>
          ),
          children: <Changes changes={changes} now={now} />,
        },
      ]}
    >
      {messageHolder}
      {header}
      {!mapping && failure !== undefined && (
        <div className={styles.padded}>
          <ErrorAlert error={failure} />
        </div>
      )}
      <CountStrip>
        <Count
          title="People mapped"
          value={counts.people}
          note={`Of ${counts.everyone} known to Olympus`}
        />
        <Count
          title="Principals"
          value={counts.principals}
          note={counts.principalNames.join(", ") || "None yet"}
        />
        <Count
          title="Privileged"
          value={counts.privileged.length}
          note={
            counts.privileged.map((r) => r.identity.split("@")[0]).join(", ") ||
            "Nobody"
          }
        />
        <Count
          title="With a certificate"
          value={counts.holding}
          note="Valid now"
        />
        <Count
          title="To review"
          value={counts.toReview}
          note={`${counts.unused} unused or never signed`}
        />
        <Count
          title="Last changed"
          value={counts.lastChange ? timeSince(counts.lastChange.at, now) : "—"}
          note={
            counts.lastChange
              ? `${counts.lastChange.identity.split("@")[0]}: ${[
                  ...counts.lastChange.added.map((p) => `+${p}`),
                  ...counts.lastChange.removed.map((p) => `−${p}`),
                ].join(" ")}`
              : "No changes yet"
          }
        />
      </CountStrip>
      <Tabs
        className={styles.tabs}
        activeKey={view}
        onChange={(key) => go(key as View)}
        items={[
          {
            key: "people",
            label: "People",
            children: (
              <MappingList
                rows={rows}
                unmapped={unmapped}
                now={now}
                busy={busy}
                onSet={set}
                onMap={(identity) => {
                  form.resetFields();
                  setMapping(identity ?? true);
                }}
              />
            ),
          },
          {
            key: "review",
            label: `To review${review.length ? ` (${review.length})` : ""}`,
            children: (
              <Review
                items={review}
                rows={rows}
                busy={busy === "review"}
                onRemove={remove}
              />
            ),
          },
        ]}
      />
      {modal}
    </SideTabPanel>
  );
}

"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Flex,
  Form,
  InputNumber,
  message,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Typography,
} from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import {
  KEYS,
  useCurrentUser,
  useSshActivity,
  useSshCas,
} from "@/lib/api/queries";
import type { SshCa, SshCertificateType } from "@/lib/api/types";
import { timeSince } from "@/lib/dashboard";
import { SSH_TYPES } from "@/lib/ssh";
import { ACTIVITY_DAYS, DAY, familiesOf, krlState } from "@/lib/sshCas";
import { Count, CountStrip } from "../../CountStrip";
import { ErrorAlert } from "../../ErrorAlert";
import { CaList } from "./CaList";
import styles from "./SshCas.module.css";
import { AuthorityGraphs, SshGraphs } from "./SshGraphs";
import { Timeline } from "./Timeline";

/** The tabs, by `?view=`. */
const VIEWS = ["authorities", "timeline"] as const;
type View = (typeof VIEWS)[number];

interface NewCa {
  type: SshCertificateType;
  number?: number;
  maxValidityHours?: number;
}

/**
 * The SSH CAs (ADR 0035): online Ed25519 keys in the signer, one per type
 * and number, rotated by generation. Their counts across the top, kept in
 * view; the certificates issued each day and the KRLs' revocations; then
 * Authorities (graphs, and the list, each CA opened to its trust line, KRL
 * and rotation) and Timeline (generations and how long each line is
 * needed).
 */
export function SshCasPage() {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const { isAdmin } = useCurrentUser();
  const { data: cas, error } = useSshCas();
  const { data: activity, error: activityError } =
    useSshActivity(ACTIVITY_DAYS);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View =
    VIEWS.find((v) => v === params.get("view")) ?? "authorities";
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [failure, setFailure] = useState<unknown>();
  const [form] = Form.useForm<NewCa>();
  const type = Form.useWatch("type", form);
  const families = useMemo(() => familiesOf(cas ?? []), [cas]);
  const go = (next: View) => {
    const query = new URLSearchParams(params.toString());
    query.set("view", next);
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  const refresh = () =>
    Promise.all([mutate(KEYS.sshCas), mutate(KEYS.sshActivity(ACTIVITY_DAYS))]);

  const create = async (request: NewCa, key: string) => {
    setBusy(key);
    try {
      const { ca } = unwrap(
        await apiClient.POST("/v1/ssh/cas", { body: request }),
      );
      setFailure(undefined);
      setCreating(false);
      await refresh();
      void messages.success(`${ca.name} created`);
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  const retire = async (ca: SshCa) => {
    setBusy(`retire-${ca.id}`);
    try {
      unwrap(
        await apiClient.POST("/v1/ssh/ca/{caId}/retire", {
          params: { path: { caId: ca.id } },
        }),
      );
      setFailure(undefined);
      await refresh();
      void messages.success(`${ca.name} retired`);
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  const rotate = (ca: SshCa) =>
    create(
      {
        type: ca.type,
        number: ca.number,
        maxValidityHours: ca.maxValidityHours,
      },
      `rotate-${ca.id}`,
    );

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
          SSH CAs
        </Typography.Title>
        <Typography.Text type="secondary">
          SSH certificates for people and hosts: a user CA vouches for who logs
          in, a host CA for what they log in to
        </Typography.Text>
      </div>
      {isAdmin && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setFailure(undefined);
            setCreating(true);
          }}
        >
          New SSH CA
        </Button>
      )}
    </Flex>
  );

  const modal = (
    <Modal
      open={creating}
      title="New SSH CA"
      okText="Create"
      confirmLoading={busy === "create"}
      destroyOnHidden
      onCancel={() => setCreating(false)}
      onOk={async () => create(await form.validateFields(), "create")}
    >
      <Form<NewCa>
        form={form}
        layout="vertical"
        initialValues={{ type: "user" }}
        preserve={false}
      >
        <Form.Item
          name="type"
          label="What it signs"
          extra={type && SSH_TYPES[type].help}
        >
          <Select
            options={(["user", "host"] as const).map((t) => ({
              value: t,
              label: `${SSH_TYPES[t].label} certificates`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="number"
          label="Number"
          extra="1 unless another CA of this type is wanted beside it. For a number that has a CA, this makes its next generation."
        >
          <InputNumber min={1} max={99} placeholder="1" />
        </Form.Item>
        <Form.Item
          name="maxValidityHours"
          label="Longest certificate it signs"
          extra="By default a week for user certificates, a year for host certificates."
        >
          <InputNumber
            min={1}
            max={400 * 24}
            addonAfter="hours"
            placeholder={type === "host" ? "8760" : "168"}
          />
        </Form.Item>
      </Form>
      <ErrorAlert error={failure} />
    </Modal>
  );

  if (!cas || !activity) {
    const problem = error ?? activityError;
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.padded}>
          <ErrorAlert error={problem} title="The SSH CAs could not be read" />
          {!problem && <Skeleton active />}
        </div>
        {modal}
      </div>
    );
  }

  const now = Date.parse(activity.asOf);
  const since = Date.parse(activity.since);
  const counts = new Map(activity.cas.map((c) => [c.caId, c]));
  const certificates = activity.certificates;
  const ofType = (t: SshCertificateType) =>
    families.filter((f) => f.type === t);
  const generationsNote = (t: SshCertificateType) =>
    ofType(t)
      .flatMap((f) =>
        f.generations.map(
          (g) =>
            `${ofType(t).length > 1 ? `${f.number} ` : ""}G${g.generation} ${g.status}`,
        ),
      )
      .join(" · ") || "None yet";
  const validOf = (t: SshCertificateType) =>
    cas
      .filter((ca) => ca.type === t)
      .reduce((sum, ca) => sum + (counts.get(ca.id)?.valid ?? 0), 0);
  const issued = activity.cas.reduce((sum, c) => sum + c.issued, 0);
  const renewals = certificates.filter(
    (c) => c.renewal && Date.parse(c.createdAt) >= since,
  ).length;
  const inKrl = activity.cas.reduce((sum, c) => sum + c.inKrl, 0);
  const revokedYear = certificates.filter(
    (c) => c.revokedAt && Date.parse(c.revokedAt) > now - 365 * DAY,
  ).length;
  const krl = krlState(cas);

  return (
    <div className={styles.page}>
      {messageHolder}
      {header}
      {!creating && failure !== undefined && (
        <div className={styles.padded}>
          <ErrorAlert error={failure} />
        </div>
      )}
      <div className={styles.sticky}>
        <CountStrip>
          <Count
            title="User CAs"
            value={ofType("user").filter((f) => f.current).length}
            note={generationsNote("user")}
          />
          <Count
            title="Host CAs"
            value={ofType("host").filter((f) => f.current).length}
            note={generationsNote("host")}
          />
          <Count
            title="Valid certificates"
            value={validOf("user") + validOf("host")}
            note={`${validOf("user")} user · ${validOf("host")} host`}
          />
          <Count
            title={`Issued, ${ACTIVITY_DAYS} days`}
            value={issued}
            note={`${issued - renewals} signed · ${renewals} hosts renewing`}
          />
          <Count
            title="In the KRLs"
            value={inKrl}
            note={`${revokedYear} revoked in a year`}
          />
          <Count
            title="KRLs"
            value={cas.length === 0 ? "—" : krl.current ? "Current" : "Due"}
            note={
              krl.publishedAt
                ? `Published ${timeSince(new Date(krl.publishedAt).toISOString(), now)}`
                : "Not yet published"
            }
          />
        </CountStrip>
      </div>
      <SshGraphs certificates={certificates} now={now} />
      <Tabs
        className={styles.tabs}
        activeKey={view}
        onChange={(key) => go(key as View)}
        items={[
          {
            key: "authorities",
            label: "Authorities",
            children: (
              <>
                <AuthorityGraphs
                  certificates={certificates}
                  since={since}
                  now={now}
                />
                <CaList
                  cas={cas}
                  activity={counts}
                  certificates={certificates}
                  now={now}
                  isAdmin={isAdmin}
                  busy={busy}
                  onRotate={rotate}
                  onRetire={retire}
                />
              </>
            ),
          },
          {
            key: "timeline",
            label: "Timeline",
            children: (
              <Timeline
                families={families}
                cas={cas}
                activity={counts}
                now={now}
              />
            ),
          },
        ]}
      />
      {modal}
    </div>
  );
}

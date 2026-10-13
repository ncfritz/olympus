import {
  CheckCircleFilled,
  ClockCircleOutlined,
  RightCircleFilled,
} from "@ant-design/icons";
import { Button, Collapse, Flex, Popconfirm, Tag, Typography } from "antd";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { SshCa, SshCaActivity } from "@/lib/api/types";
import { formatDate } from "@/lib/labels";
import { describeHours } from "@/lib/ssh";
import {
  type Family,
  familyName,
  keyTypeOf,
  PURPOSE,
  rotationOf,
  type Step,
} from "@/lib/sshCas";
import { timeSince } from "@/lib/dashboard";
import { TypeTag } from "./CaList";
import styles from "./SshCas.module.css";
import { useTypeColors } from "./SshGraphs";

/** A box's accent colour: the only value set from code. */
const accent = (color: string) => ({ "--color": color }) as CSSProperties;

/** How a family's certificates are issued and trusted, left to right. */
function Flow({ family, color }: { family: Family; color: string }) {
  const current = family.current ?? family.generations[0];
  const hours = describeHours(current.maxValidityHours);
  const nodes: [string, string][] =
    family.type === "user"
      ? [
          ["Harpocrates", `${familyName(family)} - G${current.generation}`],
          [
            "A person's machine",
            `Signs their public key: a certificate, up to ${hours}`,
          ],
          ["Every host", "sshd: TrustedUserCAKeys and RevokedKeys"],
        ]
      : [
          ["Harpocrates", `${familyName(family)} - G${current.generation}`],
          [
            "Every host",
            `Its host key certified, up to ${hours}; it renews itself`,
          ],
          ["Every client", "known_hosts: @cert-authority"],
        ];
  const arrows =
    family.type === "user"
      ? ["issues a certificate", "presents it to log in"]
      : ["certifies the host key", "presents it on connect"];
  return (
    <div className={styles.flow} aria-label="How it is trusted">
      {nodes.map(([title, note], i) => (
        <Flex key={title} className={styles.grow} gap={4}>
          <div
            className={styles.flowBox}
            style={i === 0 ? accent(color) : undefined}
          >
            <Typography.Text strong>{title}</Typography.Text>
            <br />
            <Typography.Text type="secondary" className={styles.small}>
              {note}
            </Typography.Text>
          </div>
          {i < arrows.length && (
            <div className={styles.flowArrow} aria-hidden>
              {arrows[i]}
              <span>→</span>
            </div>
          )}
        </Flex>
      ))}
    </div>
  );
}

const STEP_ICON: Record<Step["state"], ReactNode> = {
  done: <CheckCircleFilled className={styles.stepDone} aria-label="Done" />,
  next: <RightCircleFilled className={styles.stepNext} aria-label="Next" />,
  later: (
    <ClockCircleOutlined className={styles.stepLater} aria-label="Later" />
  ),
};

/** A rotation, step by step: what is done, what is next. */
export function RotationSteps({ steps }: { steps: Step[] }) {
  return (
    <Flex vertical gap={8}>
      {steps.map((step) => (
        <Flex key={step.key} gap="small" align="flex-start">
          {STEP_ICON[step.state]}
          <Flex vertical className={styles.shrink}>
            <Typography.Text
              type={step.state === "later" ? "secondary" : undefined}
              strong={step.state === "next"}
            >
              {step.title}
              {step.at && (
                <Typography.Text type="secondary" className={styles.small}>
                  {" "}
                  {formatDate(step.at)}
                </Typography.Text>
              )}
            </Typography.Text>
            {step.detail && (
              <Typography.Text type="secondary" className={styles.small}>
                {step.detail}
              </Typography.Text>
            )}
          </Flex>
        </Flex>
      ))}
    </Flex>
  );
}

/** A copyable value: a trust line, a URL. */
export const Copyable = ({ text }: { text: string }) => (
  <div className={styles.copyRow}>
    <code className={styles.code} title={text}>
      {text}
    </code>
    <Typography.Text copyable={{ text }} />
  </div>
);

/** A family's settings, trust, revocations and rotation. */
function FamilyBody({
  family,
  activity,
  now,
}: {
  family: Family;
  activity: Map<string, SshCaActivity>;
  now: number;
}) {
  const colors = useTypeColors();
  const ca = family.current ?? family.generations[0];
  const steps = rotationOf(family, activity, now);
  const counts = activity.get(ca.id);
  return (
    <>
      <Flow family={family} color={colors[family.type]} />
      <div className={styles.familyBody}>
        <div className={styles.box}>
          <Typography.Text className={styles.label}>
            Trust line:{" "}
            {family.type === "user"
              ? "for the file TrustedUserCAKeys names in every host's sshd_config"
              : "for every client's known_hosts (or /etc/ssh/ssh_known_hosts)"}
          </Typography.Text>
          <Copyable text={ca.trustLine} />
          <Typography.Text className={styles.label}>
            KRL: every {family.type} CA&apos;s revocations together, which{" "}
            {family.type === "user"
              ? "hosts fetch into the file RevokedKeys names"
              : "clients may fetch into the file RevokedHostKeys names"}
          </Typography.Text>
          <Copyable text={ca.typeKrlUrl} />
          <Flex gap="middle" wrap className={styles.small}>
            <span>
              <Typography.Text type="secondary">Key</Typography.Text>{" "}
              {keyTypeOf(ca)}
            </span>
            <span>
              <Typography.Text type="secondary">Longest</Typography.Text>{" "}
              {describeHours(ca.maxValidityHours)}
            </span>
            <span>
              <Typography.Text type="secondary">KRL</Typography.Text>{" "}
              {ca.krlDueAt
                ? "a new one due"
                : ca.krlPublishedAt
                  ? `v${ca.krlVersion}, ${counts?.inKrl ?? 0} entr${counts?.inKrl === 1 ? "y" : "ies"}, published ${timeSince(ca.krlPublishedAt, now)}`
                  : "not yet published"}
            </span>
            <span>
              <Typography.Text type="secondary">ID</Typography.Text>{" "}
              <span className={styles.mono}>{ca.id}</span>
            </span>
          </Flex>
        </div>
        <div className={styles.box}>
          <Typography.Text className={styles.label}>
            {steps
              ? `Rotation G${family.generations[1].generation} → G${family.generations[0].generation}`
              : "Rotation"}
          </Typography.Text>
          {steps ? (
            <RotationSteps steps={steps} />
          ) : (
            <Typography.Text type="secondary">
              G{ca.generation} since {formatDate(ca.createdAt)}. Rotating makes
              G{ca.generation + 1}: install its line beside G{ca.generation}
              &apos;s, then retire G{ca.generation} and, once its last
              certificate expires, take its line out.
            </Typography.Text>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The Configuration tab: each CA (a type and number, its generations
 * together) a panel to open or close: how it is trusted, its trust line
 * and KRL to install, and its rotation step by step.
 */
export function Configuration({
  families,
  activity,
  now,
  open,
  onOpenChange,
  isAdmin,
  busy,
  onRotate,
  onRetire,
}: {
  families: Family[];
  activity: Map<string, SshCaActivity>;
  now: number;
  open: string[];
  onOpenChange: (keys: string[]) => void;
  isAdmin: boolean;
  busy?: string;
  onRotate: (ca: SshCa) => void;
  onRetire: (ca: SshCa) => void;
}) {
  return (
    <Collapse
      className={styles.collapse}
      activeKey={open}
      onChange={(keys) => onOpenChange(Array.isArray(keys) ? keys : [keys])}
      items={families.map((family) => {
        const ca = family.current ?? family.generations[0];
        const valid = family.generations.reduce(
          (sum, g) => sum + (activity.get(g.id)?.valid ?? 0),
          0,
        );
        // An older generation still active: retire it once its line is everywhere.
        const older = family.generations.find(
          (g) => g !== family.current && g.status === "active",
        );
        return {
          key: family.key,
          label: (
            <Flex
              gap="small"
              align="center"
              wrap
              id={`ssh-family-${family.key}`}
            >
              <Typography.Text strong>
                {familyName(family)}: {PURPOSE[family.type]}
              </Typography.Text>
              <TypeTag ca={family} />
              {family.generations.map((g) => (
                <Tag
                  key={g.id}
                  color={g.status === "active" ? "green" : undefined}
                >
                  G{g.generation} {g.status}
                  {g.retiredAt ? ` ${formatDate(g.retiredAt)}` : ""}
                </Tag>
              ))}
            </Flex>
          ),
          extra: (
            <Flex gap="small" wrap onClick={(e) => e.stopPropagation()}>
              <Link href="/ssh/certificates">
                <Button size="small">Its certificates ({valid} valid)</Button>
              </Link>
              {isAdmin && family.current && !older && (
                <Popconfirm
                  title={`Rotate ${familyName(family)} to G${ca.generation + 1}?`}
                  description="A new key, its own line to install beside this one's. Profiles that are not pinned move to it at once."
                  okText="Rotate"
                  onConfirm={() => onRotate(ca)}
                >
                  <Button size="small" loading={busy === `rotate-${ca.id}`}>
                    Rotate to G{ca.generation + 1}
                  </Button>
                </Popconfirm>
              )}
              {isAdmin && family.current && !older && (
                <Popconfirm
                  title={`Retire ${ca.name}?`}
                  description="It signs nothing more, and nothing of its type and number signs in its place until it is rotated. What it signed stays valid until it expires."
                  okText="Retire"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onRetire(ca)}
                >
                  <Button
                    size="small"
                    danger
                    loading={busy === `retire-${ca.id}`}
                  >
                    Retire
                  </Button>
                </Popconfirm>
              )}
              {isAdmin && older && (
                <Popconfirm
                  title={`Retire ${older.name}?`}
                  description="It signs nothing more. What it signed stays valid until it expires, so keep its line until then."
                  okText="Retire"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onRetire(older)}
                >
                  <Button
                    size="small"
                    danger
                    loading={busy === `retire-${older.id}`}
                  >
                    Retire G{older.generation}
                  </Button>
                </Popconfirm>
              )}
            </Flex>
          ),
          children: (
            <FamilyBody family={family} activity={activity} now={now} />
          ),
        };
      })}
    />
  );
}

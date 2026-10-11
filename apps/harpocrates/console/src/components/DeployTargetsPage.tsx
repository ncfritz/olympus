"use client";

import { CloudUploadOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { expectOk, unwrap } from "@/lib/api/errors";
import {
  KEYS,
  useCurrentUser,
  useDeployTarget,
  useDeployTargets,
} from "@/lib/api/queries";
import type { DeployTarget, Deployment } from "@/lib/api/types";
import { deploymentState, formatDate, formatDateTime } from "@/lib/labels";
import { DeployTargetForm } from "./DeployTargetForm";
import { ErrorAlert } from "./ErrorAlert";

const DeploymentTag = ({ deployment }: { deployment?: Deployment }) => {
  const { label, color } = deploymentState(deployment);
  const tag = <Tag color={color}>{label}</Tag>;
  return deployment?.lastError && deployment.status === "pending" ? (
    <Tooltip title={deployment.lastError}>{tag}</Tooltip>
  ) : (
    tag
  );
};

/**
 * Deploy targets (ADR 0020, Renewal and delivery): where certificates are
 * installed for what cannot renew them, renewed and deployed by the
 * service. One at a time in a drawer, opened from `?id=`.
 */
export function DeployTargetsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("id") ?? undefined;
  const [creating, setCreating] = useState(false);
  const { isAdmin } = useCurrentUser();
  const { data, error, isLoading } = useDeployTargets();
  const show = (id?: string) =>
    router.push(id ? `/deploy-targets?id=${id}` : "/deploy-targets");

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>Deploy targets</Typography.Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreating(true)}
          >
            New target
          </Button>
        )}
      </Flex>
      <Typography.Paragraph type="secondary">
        Certificates installed for what can neither renew over mutual TLS nor
        speak ACME. Harpocrates renews each when its profile says, and deploys
        every new certificate; nginx reloads when one lands.
      </Typography.Paragraph>
      <ErrorAlert error={error} />
      <Table<DeployTarget>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data ?? []}
        onRow={(target) => ({ onClick: () => show(target.id) })}
        pagination={false}
        columns={[
          { title: "Name", dataIndex: "name" },
          { title: "Certificate", dataIndex: "subject", ellipsis: true },
          {
            title: "Deployed",
            key: "deployed",
            render: (_, target) => (
              <DeploymentTag deployment={target.lastDeployment} />
            ),
          },
          { title: "Renews", dataIndex: "renewsAt", render: formatDate },
          { title: "Expires", dataIndex: "notAfter", render: formatDate },
        ]}
      />
      <Modal
        open={creating}
        title="New deploy target"
        footer={null}
        destroyOnHidden
        onCancel={() => setCreating(false)}
      >
        <DeployTargetForm
          onCreated={(target) => {
            setCreating(false);
            show(target.id);
          }}
        />
      </Modal>
      <DeployTargetDrawer targetId={open} onClose={() => show()} />
    </Flex>
  );
}

function DeployTargetDrawer({
  targetId,
  onClose,
}: {
  targetId?: string;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const { isAdmin } = useCurrentUser();
  const { data: target, error } = useDeployTarget(targetId);
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState<"deploy" | "update" | "delete">();
  const [moving, setMoving] = useState(false);

  const refresh = () =>
    mutate(
      (key) =>
        typeof key === "string" &&
        (key === KEYS.deployTargets || key.startsWith("/deploy-target/")),
    );

  const act = async (
    kind: "deploy" | "update" | "delete",
    run: () => Promise<string | undefined>,
  ) => {
    setBusy(kind);
    try {
      const done = await run();
      setFailure(undefined);
      await refresh();
      if (done) void messages.success(done);
    } catch (problem) {
      setFailure(problem);
    } finally {
      setBusy(undefined);
    }
  };

  const outcome = (deployment?: Deployment) =>
    deployment?.status === "deployed"
      ? "Deployed"
      : "Not deployed yet: it is retried";

  return (
    <Drawer
      open={Boolean(targetId)}
      onClose={() => {
        setMoving(false);
        setFailure(undefined);
        onClose();
      }}
      size="large"
      title={target?.name ?? "Deploy target"}
    >
      {messageHolder}
      <ErrorAlert error={error} />
      {target && (
        <Flex vertical gap="large">
          {target.lastDeployment?.status === "pending" &&
            target.lastDeployment.lastError && (
              <Alert
                type="error"
                showIcon
                title={`Failing after ${target.lastDeployment.attempts} attempts; retried`}
                description={target.lastDeployment.lastError}
              />
            )}
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Kind">
              Files for nginx, in{" "}
              <Typography.Text code>
                /srv/harpocrates/deployed/{target.name}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Certificate">
              <Link
                href={`/certificates?certificateId=${target.certificateId}`}
              >
                {target.subject}
              </Link>
            </Descriptions.Item>
            <Descriptions.Item label="Renews">
              {formatDateTime(target.renewsAt)}, by Harpocrates
            </Descriptions.Item>
            <Descriptions.Item label="Expires">
              {formatDateTime(target.notAfter)}
            </Descriptions.Item>
            <Descriptions.Item label="Deployed">
              <DeploymentTag deployment={target.lastDeployment} />
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {formatDateTime(target.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {formatDateTime(target.updatedAt)}
            </Descriptions.Item>
          </Descriptions>
          <Flex gap="small" wrap>
            <Button
              icon={<CloudUploadOutlined />}
              loading={busy === "deploy"}
              onClick={() =>
                act("deploy", async () => {
                  const { deployTarget } = unwrap(
                    await apiClient.POST(
                      "/v1/deploy-target/{targetId}/deploy",
                      {
                        params: { path: { targetId: target.id } },
                      },
                    ),
                  );
                  return outcome(deployTarget.lastDeployment);
                })
              }
            >
              Deploy again
            </Button>
            {isAdmin && (
              <Button onClick={() => setMoving((value) => !value)}>
                Point at another certificate
              </Button>
            )}
            {isAdmin && (
              <Popconfirm
                title="Delete this target?"
                description="Harpocrates stops renewing and deploying it. Its files stay, and nginx serves them until its configuration stops naming them."
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() =>
                  act("delete", async () => {
                    expectOk(
                      await apiClient.DELETE("/v1/deploy-target/{targetId}", {
                        params: { path: { targetId: target.id } },
                      }),
                    );
                    onClose();
                    return "Deleted";
                  })
                }
              >
                <Button danger loading={busy === "delete"}>
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Flex>
          {moving && (
            <Form<{ certificateId: string }>
              layout="vertical"
              onFinish={({ certificateId }) =>
                act("update", async () => {
                  const { deployTarget } = unwrap(
                    await apiClient.PUT("/v1/deploy-target/{targetId}", {
                      params: { path: { targetId: target.id } },
                      body: { certificateId },
                    }),
                  );
                  setMoving(false);
                  return outcome(deployTarget.lastDeployment);
                })
              }
            >
              <Form.Item
                name="certificateId"
                label="Certificate ID"
                extra="A reissue, after this one was revoked. Renewals the target follows by itself."
                rules={[{ required: true, message: "The certificate's ID" }]}
              >
                <Input />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={busy === "update"}
              >
                Deploy it here
              </Button>
            </Form>
          )}
          <ErrorAlert error={failure} />
          <Typography.Title level={5}>Deployments</Typography.Title>
          <Table<Deployment>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={target.deployments}
            columns={[
              {
                title: "Asked",
                dataIndex: "createdAt",
                render: formatDateTime,
              },
              { title: "Serial", dataIndex: "serial", ellipsis: true },
              { title: "By", dataIndex: "principal" },
              {
                title: "State",
                key: "state",
                render: (_, deployment) => (
                  <DeploymentTag deployment={deployment} />
                ),
              },
              { title: "Attempts", dataIndex: "attempts" },
              {
                title: "Deployed",
                dataIndex: "deployedAt",
                render: formatDateTime,
              },
            ]}
          />
        </Flex>
      )}
    </Drawer>
  );
}

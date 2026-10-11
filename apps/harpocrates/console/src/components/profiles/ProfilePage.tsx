"use client";

import {
  CopyOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Button, Flex, message, Popconfirm, Tabs, Tag, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import {
  KEYS,
  useCurrentUser,
  useProfiles,
  useProfileVersions,
} from "@/lib/api/queries";
import { formatDate } from "@/lib/labels";
import { settingsOf } from "@/lib/profileSettings";
import { ErrorAlert } from "../ErrorAlert";
import { CopyProfileModal } from "./CopyProfileModal";
import { ProfileHistory } from "./ProfileHistory";
import { ProfilePreviewPanel } from "./ProfilePreviewPanel";
import { ProfileSettingsView } from "./ProfileSettingsView";

/**
 * One profile (ADR 0034): its latest version's settings, its versions and
 * what changed between them, and the certificate it produces; an admin
 * edits it into its next version, copies a version into a new profile,
 * and deactivates or reactivates it.
 */
export function ProfilePage({ profileId }: { profileId: string }) {
  const { data: profiles, error } = useProfiles();
  const { data: versions } = useProfileVersions(profileId);
  const { isAdmin } = useCurrentUser();
  const { mutate } = useSWRConfig();
  const [copying, setCopying] = useState(false);
  const [actionError, setActionError] = useState<unknown>();
  const profile = profiles?.find((p) => p.id === profileId);

  if (!profile) {
    return (
      <Flex vertical gap="large">
        <ErrorAlert error={error} />
        {profiles && (
          <Typography.Text>There is no profile {profileId}.</Typography.Text>
        )}
      </Flex>
    );
  }

  const setActive = async (active: boolean) => {
    setActionError(undefined);
    try {
      const path = { params: { path: { profileId } } };
      unwrap(
        active
          ? await apiClient.POST("/v1/profile/{profileId}/reactivate", path)
          : await apiClient.POST("/v1/profile/{profileId}/deactivate", path),
      );
      await mutate(KEYS.profiles);
      message.success(
        active
          ? `${profileId} is active again`
          : `${profileId} is deactivated: what it issued still renews`,
      );
    } catch (caught: unknown) {
      setActionError(caught);
    }
  };

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="start" wrap gap="middle">
        <Flex vertical gap={4}>
          <Flex gap="small" align="center">
            <Typography.Title level={3}>{profile.id}</Typography.Title>
            <Tag>v{profile.version}</Tag>
            {profile.active ? (
              <Tag color="green">active</Tag>
            ) : (
              <Tag color="red">
                inactive since {formatDate(profile.deactivatedAt)}
              </Tag>
            )}
            {profile.directOnly && (
              <Tag color="purple">root signs directly</Tag>
            )}
          </Flex>
          <Typography.Text type="secondary">
            {profile.description}
          </Typography.Text>
        </Flex>
        {isAdmin && (
          <Flex gap="small" wrap>
            <Link href={`/profiles/edit?id=${profile.id}`}>
              <Button icon={<EditOutlined />}>Edit</Button>
            </Link>
            <Button icon={<CopyOutlined />} onClick={() => setCopying(true)}>
              Copy
            </Button>
            {profile.active ? (
              <Popconfirm
                title={`Deactivate ${profile.id}?`}
                description="Nothing new is issued under it; what it issued still renews."
                okText="Deactivate"
                onConfirm={() => setActive(false)}
              >
                <Button danger icon={<PauseCircleOutlined />}>
                  Deactivate
                </Button>
              </Popconfirm>
            ) : (
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => setActive(true)}
              >
                Reactivate
              </Button>
            )}
          </Flex>
        )}
      </Flex>
      <ErrorAlert error={actionError} />
      <Tabs
        items={[
          {
            key: "settings",
            label: "Settings",
            children: <ProfileSettingsView settings={settingsOf(profile)} />,
          },
          {
            key: "history",
            label: `History (${versions?.length ?? "…"})`,
            children: versions && <ProfileHistory versions={versions} />,
          },
          ...(isAdmin
            ? [
                {
                  key: "preview",
                  label: "Preview",
                  children: (
                    <ProfilePreviewPanel
                      settings={settingsOf(profile)}
                      directOnly={profile.directOnly}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      {versions && (
        <CopyProfileModal
          profile={profile}
          versions={versions}
          open={copying}
          onClose={() => setCopying(false)}
        />
      )}
    </Flex>
  );
}

import { Checkbox, Typography } from "antd";
import { useState } from "react";
import notificationsApi from "../../api/notificationsApi";
import { Events, publish } from "../../utils/events";
=
export interface NotificationSettings {
  webSocketEnabled: boolean;
  synoChatEnabled: boolean;
  synoMailEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationSettingsListEntryProps {
  notificationType: any;
  initialSettings: NotificationSettings;
  afterUpdate: () => Promise<void>;
}

const NotificationSettingsListEntry: React.FunctionComponent<
  NotificationSettingsListEntryProps
> = ({
  notificationType,
  initialSettings,
  afterUpdate,
}: NotificationSettingsListEntryProps) => {
  const [settings, setSettings] =
    useState<NotificationSettings>(initialSettings);
  const [loading, setLoading] = useState<boolean>(false);

  const enabledCount = () => {
    let enabled = 0;
    let count = 0;

    if (notificationType.supportsWebSocket) {
      count++;
      if (settings.webSocketEnabled) enabled++;
    }

    if (notificationType.supportsSynoChat) {
      count++;
      if (settings.synoChatEnabled) enabled++;
    }

    if (notificationType.supportsSynoMail) {
      count++;
      if (settings.synoMailEnabled) enabled++;
    }

    if (notificationType.supportsEmail) {
      count++;
      if (settings.emailEnabled) enabled++;
    }

    return [count, enabled];
  };

  const isAllIntermediate = () => {
    const [count, enabled] = enabledCount();
    return enabled !== 0 && enabled !== count;
  };

  const isAllChecked = () => {
    const [count, enabled] = enabledCount();
    return enabled === count;
  };

  const updateSettings = async (
    ws: boolean,
    sc: boolean,
    sm: boolean,
    em: boolean,
  ) => {
    const newSettings = { ...settings };

    if (notificationType.supportsWebSocket) newSettings.webSocketEnabled = ws;
    if (notificationType.supportsSynoChat) newSettings.synoChatEnabled = sc;
    if (notificationType.supportsSynoMail) newSettings.synoMailEnabled = sm;
    if (notificationType.supportsEmail) newSettings.emailEnabled = em;

    setLoading(true);

    try {
      const updateResponse = await notificationsApi.updateNotificationSetting(
        notificationType.id,
        {
          notificationSetting: {
            webSocketEnabled:
              notificationType.supportsWebSocket &&
              newSettings.webSocketEnabled,
            synoChatEnabled:
              notificationType.supportsSynoChat && newSettings.synoChatEnabled,
            synoMailEnabled:
              notificationType.supportsSynoMail && newSettings.synoMailEnabled,
            emailEnabled:
              notificationType.supportsEmail && newSettings.emailEnabled,
          },
        },
      );

      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "success",
        message: "Settings updated",
        description: `Settings for "${notificationType.name}" have been updated successfully.`,
        closable: true,
      });

      await afterUpdate();
    } catch (e) {
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Unable to update settings",
        description: `Settings for "${notificationType.name}" could not be updated.`,
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr>
      <td
        style={{
          paddingLeft: 16,
        }}
      >
        <Typography.Text
          style={{ fontSize: 12, fontWeight: "bold", display: "block" }}
        >
          {notificationType.name}
        </Typography.Text>
        <Typography.Text style={{ fontSize: 10, color: "#666666" }}>
          {notificationType.description}
        </Typography.Text>
      </td>
      <td align={"center"}>
        <Checkbox
          disabled={
            !(
              notificationType.supportsWebSocket ||
              notificationType.supportsSynoChat ||
              notificationType.supportsSynoMail ||
              notificationType.supportsEmail
            )
          }
          indeterminate={isAllIntermediate()}
          checked={isAllChecked()}
          onClick={async () => {
            const [count, enabled] = enabledCount();

            if (enabled === count) {
              await updateSettings(false, false, false, false);
            } else {
              await updateSettings(true, true, true, true);
            }
          }}
        />
      </td>
      <td align={"center"}>
        <Checkbox
          disabled={!notificationType.supportsWebSocket}
          checked={settings.webSocketEnabled}
          onClick={async () => {
            await updateSettings(
              !settings.webSocketEnabled,
              settings.synoChatEnabled,
              settings.synoMailEnabled,
              settings.emailEnabled,
            );
          }}
        />
      </td>
      <td align={"center"}>
        <Checkbox
          disabled={!notificationType.supportsSynoChat}
          checked={settings.synoChatEnabled}
          onClick={async () => {
            await updateSettings(
              settings.webSocketEnabled,
              !settings.synoChatEnabled,
              settings.synoMailEnabled,
              settings.emailEnabled,
            );
          }}
        />
      </td>
      <td align={"center"}>
        <Checkbox
          disabled={!notificationType.supportsSynoMail}
          checked={settings.synoMailEnabled}
          onClick={async () => {
            await updateSettings(
              settings.webSocketEnabled,
              settings.synoChatEnabled,
              !settings.synoMailEnabled,
              settings.emailEnabled,
            );
          }}
        />
      </td>
      <td align={"center"}>
        <Checkbox
          disabled={!notificationType.supportsEmail}
          checked={settings.emailEnabled}
          onClick={async () => {
            await updateSettings(
              settings.webSocketEnabled,
              settings.synoChatEnabled,
              settings.synoMailEnabled,
              !settings.emailEnabled,
            );
          }}
        />
      </td>
    </tr>
  );
};
export default NotificationSettingsListEntry;

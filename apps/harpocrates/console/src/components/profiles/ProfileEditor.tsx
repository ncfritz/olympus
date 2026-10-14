"use client";

import { DeleteOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { SideTabPanel } from "@ncfritz/olympus-console";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Switch,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import {
  KEYS,
  useIssuerOcsp,
  useIssuers,
  useProfiles,
  useSshCas,
} from "@/lib/api/queries";
import type { ProfileKind, SshCertificateType } from "@/lib/api/types";
import {
  choicesOf,
  CSR_HASHES,
  fromForm,
  KEY_ALGORITHMS,
  KEY_USAGES,
  KNOWN_EKUS,
  NAME_TYPES,
  NEW_PROFILE_SETTINGS,
  newSshProfileSettings,
  type ProfileForm,
  SECTIONS,
  type SettingKey,
  settingsOf,
  SUBJECT_ATTRIBUTES,
  SSH_KEY_ALGORITHMS,
  SUBTREE_TYPES,
  toForm,
  USAGE_STATES,
} from "@/lib/profileSettings";
import { currentResponder } from "@/lib/ocsp";
import { NEW_SSH_SETTINGS, SSH_EXTENSIONS, SSH_TYPES } from "@/lib/ssh";
import { useLeaveWarning } from "@/lib/useLeaveWarning";
import { ErrorAlert } from "../ErrorAlert";
import styles from "./ProfileEditor.module.css";
import { ProfilePreviewPanel } from "./ProfilePreviewPanel";
import { SettingLabel, SshSettingLabel } from "./SettingLabel";
import { RecentSignInNotice } from "../RecentSignIn";

/** The service's rule for a profile's name. */
const PROFILE_SLUG = /^[a-z][a-z0-9-]{0,62}$/;
const OID = /^[0-2](\.(0|[1-9][0-9]*))+$/;

const PANEL_WIDTH = 600;

const days = { addonAfter: "days", min: 1, className: styles.number };
const hours = { addonAfter: "hours", min: 1, className: styles.number };

/** A form item labelled by its setting, with the setting's help. */
const Setting = ({
  setting,
  children,
  switch: isSwitch,
  ...rest
}: {
  setting: SettingKey;
  children: ReactNode;
  switch?: boolean;
  rules?: Parameters<typeof Form.Item>[0]["rules"];
}) => (
  <Form.Item
    name={setting}
    label={<SettingLabel setting={setting} />}
    valuePropName={isSwitch ? "checked" : undefined}
    {...rest}
  >
    {children}
  </Form.Item>
);

/** A list setting's rows, with a button to add one. */
const Rows = ({
  setting,
  add,
  row,
}: {
  setting: SettingKey;
  add: { label: string; value: object };
  row: (field: { name: number; key: number }) => ReactNode;
}) => (
  <Form.Item label={<SettingLabel setting={setting} />}>
    <Form.List name={setting}>
      {(fields, { add: append, remove }) => (
        <Flex vertical gap="small">
          {fields.map((field) => (
            <Flex key={field.key} gap="small" align="start" wrap>
              {row(field)}
              <Tooltip title="Remove">
                <Button
                  aria-label="Remove"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(field.name)}
                />
              </Tooltip>
            </Flex>
          ))}
          <div>
            <Button icon={<PlusOutlined />} onClick={() => append(add.value)}>
              {add.label}
            </Button>
          </div>
        </Flex>
      )}
    </Form.List>
  </Form.Item>
);

const usageOptions = USAGE_STATES.map((s) => ({
  value: s.value,
  label: s.label,
}));

/**
 * A profile's editor (ADR 0034): a new profile (`?kind=ssh` for an SSH
 * one, ADR 0035), or the next version of one (`?id=`), in the settings'
 * sections, each setting with its help; beside it, the certificate the
 * settings would produce, as they change. Saving a change of settings
 * makes the profile's next version; the description alone makes none.
 */
export function ProfileEditor() {
  const query = useSearchParams();
  const editing = query.get("id") ?? undefined;
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: profiles, error: loadError } = useProfiles();
  const { data: issuers } = useIssuers();
  const profile = profiles?.find((p) => p.id === editing);
  const kind: ProfileKind = editing
    ? (profile?.kind ?? "x509")
    : query.get("kind") === "ssh"
      ? "ssh"
      : "x509";
  const initial = useMemo(
    () =>
      toForm(
        profile
          ? settingsOf(profile)
          : kind === "ssh"
            ? newSshProfileSettings("user")
            : NEW_PROFILE_SETTINGS,
        profile,
      ),
    [profile, kind],
  );
  const [form] = Form.useForm<ProfileForm>();
  const [values, setValues] = useState<ProfileForm>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>();
  useLeaveWarning(dirty);

  const settings = fromForm(values ?? initial);
  const purpose = Form.useWatch("issuerPurpose", form);
  const sshType: SshCertificateType | undefined = Form.useWatch(
    ["ssh", "certificateType"],
    form,
  );
  const { data: sshCas } = useSshCas();
  // Its CA's OCSP, while its certificates would carry the URL: the service
  // refuses to issue them with no responder in service (ADR 0036).
  const { data: ocsp } = useIssuerOcsp(
    kind === "x509" && settings.includeOcsp
      ? (settings.issuerId ?? undefined)
      : undefined,
  );
  const noResponder = Boolean(ocsp && !currentResponder(ocsp.responders));
  const issuing = (issuers ?? []).filter(
    (i) => i.tier === "issuing" && i.status === "active",
  );
  const purposes = [
    ...new Set(issuing.map((i) => i.purpose).filter(Boolean) as string[]),
  ];

  if (editing && !profile) {
    return (
      <Flex vertical gap="large">
        <ErrorAlert error={loadError} />
        {profiles && <Typography.Text>No profile {editing}.</Typography.Text>}
      </Flex>
    );
  }

  const save = async () => {
    const form_ = await form.validateFields();
    const all = { ...initial, ...form_ };
    setSaving(true);
    setError(undefined);
    try {
      const body = fromForm(all);
      const saved = editing
        ? unwrap(
            await apiClient.PUT("/v1/profile/{profileId}", {
              params: { path: { profileId: editing } },
              body: {
                profile: { ...body, description: all.description },
              },
            }),
          ).profile
        : unwrap(
            await apiClient.POST("/v1/profiles", {
              body: {
                profile: {
                  ...body,
                  kind,
                  id: all.id!,
                  description: all.description!,
                },
              },
            }),
          ).profile;
      await mutate(KEYS.profiles);
      await mutate(KEYS.profileVersions(saved.id));
      setDirty(false);
      message.success(
        editing
          ? saved.version === profile!.version
            ? `${saved.id} saved: its settings are unchanged, still v${saved.version}`
            : `${saved.id} saved as v${saved.version}`
          : `${saved.id} made, at v1`,
      );
      router.push(`/profiles?id=${saved.id}`);
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  const sections: Record<string, ReactNode> = {
    issuance: (
      <>
        <Setting
          setting="issuerPurpose"
          rules={[{ required: true, message: "Required" }]}
        >
          <AutoComplete
            options={purposes.map((p) => ({ value: p }))}
            placeholder="TLS"
          />
        </Setting>
        <Setting setting="issuerId">
          <Select
            allowClear
            placeholder="The active issuing CA of its purpose"
            options={issuing
              .filter((i) => !purpose || i.purpose === purpose)
              .map((i) => ({ value: i.id, label: i.id }))}
          />
        </Setting>
        <Flex gap="middle" wrap>
          <Setting setting="validityDays">
            <InputNumber {...days} />
          </Setting>
          <Setting setting="renewAtDays">
            <InputNumber {...days} />
          </Setting>
          <Setting setting="maxKeyAgeDays">
            <InputNumber {...days} />
          </Setting>
        </Flex>
      </>
    ),
    keys: (
      <>
        <Flex gap="middle" wrap>
          <Setting setting="keyAlgorithm">
            <Select
              className={styles.select}
              options={KEY_ALGORITHMS.map((k) => ({ value: k }))}
            />
          </Setting>
          <Setting setting="keyAlgorithms">
            <Select
              mode="multiple"
              allowClear
              className={styles.wide}
              placeholder="Any"
              options={KEY_ALGORITHMS.map((k) => ({ value: k }))}
            />
          </Setting>
        </Flex>
        <Flex gap="large" wrap>
          <Setting setting="allowCsr" switch>
            <Switch />
          </Setting>
          <Setting setting="allowGenerated" switch>
            <Switch />
          </Setting>
          <Setting setting="escrow" switch>
            <Switch />
          </Setting>
          <Setting setting="escrowOverridable" switch>
            <Switch />
          </Setting>
          <Setting setting="legacyExport" switch>
            <Switch />
          </Setting>
        </Flex>
        <Setting setting="csrSignatureHashes">
          <Select
            mode="multiple"
            allowClear
            className={styles.wide}
            placeholder="Any"
            options={CSR_HASHES.map((h) => ({
              value: h,
              label: h.toUpperCase(),
            }))}
          />
        </Setting>
      </>
    ),
    subject: (
      <Rows
        setting="subjectAttributes"
        add={{
          label: "Add an attribute",
          value: { presence: "optional", locked: false, maxCount: 1 },
        }}
        row={(field) => (
          <>
            <Form.Item
              name={[field.name, "attribute"]}
              rules={[{ required: true, message: "Which attribute" }]}
              noStyle
            >
              <AutoComplete
                className={styles.attribute}
                placeholder="Attribute or OID"
                options={SUBJECT_ATTRIBUTES.map((a) => ({
                  value: a.value,
                  label: `${a.value}: ${a.label}`,
                }))}
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item name={[field.name, "presence"]} noStyle>
              <Select
                className={styles.select}
                aria-label="Presence"
                options={[
                  { value: "required", label: "Required" },
                  { value: "optional", label: "Optional" },
                  { value: "excluded", label: "Excluded" },
                ]}
              />
            </Form.Item>
            <Form.Item name={[field.name, "defaultValue"]} noStyle>
              <Input className={styles.text} placeholder="Default" />
            </Form.Item>
            <Form.Item
              name={[field.name, "locked"]}
              valuePropName="checked"
              noStyle
            >
              <Checkbox>Locked</Checkbox>
            </Form.Item>
            <Form.Item name={[field.name, "pattern"]} noStyle>
              <Input className={styles.text} placeholder="Pattern" />
            </Form.Item>
            <Form.Item name={[field.name, "maxCount"]} noStyle>
              <InputNumber
                min={1}
                max={16}
                aria-label="How many values"
                addonBefore="up to"
                className={styles.count}
              />
            </Form.Item>
          </>
        )}
      />
    ),
    names: (
      <>
        <Form.Item label={<SettingLabel setting="names" />}>
          <Flex vertical gap="small">
            {NAME_TYPES.map((type) => (
              <Flex key={type.value} gap="middle" align="center">
                <Tooltip title={type.help}>
                  <span className={styles.nameType}>{type.label}</span>
                </Tooltip>
                <Form.Item name={["namePresences", type.value]} noStyle>
                  <Select
                    className={styles.select}
                    aria-label={type.label}
                    options={[
                      { value: "required", label: "Required" },
                      { value: "allowed", label: "Allowed" },
                      { value: "excluded", label: "Excluded" },
                    ]}
                  />
                </Form.Item>
              </Flex>
            ))}
          </Flex>
        </Form.Item>
        <Setting setting="minNames">
          <InputNumber min={0} max={100} className={styles.number} />
        </Setting>
        <Rows
          setting="namePolicy"
          add={{
            label: "Add a subtree",
            value: { type: "dns", kind: "permitted" },
          }}
          row={(field) => (
            <>
              <Form.Item name={[field.name, "type"]} noStyle>
                <Select
                  className={styles.select}
                  aria-label="Type"
                  options={SUBTREE_TYPES.map((t) => ({ value: t }))}
                />
              </Form.Item>
              <Form.Item name={[field.name, "kind"]} noStyle>
                <Select
                  className={styles.select}
                  aria-label="Kind"
                  options={[
                    { value: "permitted", label: "Permitted" },
                    { value: "excluded", label: "Excluded" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name={[field.name, "value"]}
                rules={[{ required: true, message: "The subtree" }]}
                noStyle
              >
                <Input
                  className={styles.wide}
                  placeholder="internal.ncfritz.net, 10.0.0.0/8"
                />
              </Form.Item>
            </>
          )}
        />
      </>
    ),
    usages: (
      <>
        <Form.Item label={<SettingLabel setting="keyUsages" />}>
          <Flex vertical gap="small">
            {KEY_USAGES.map((usage) => (
              <Flex key={usage.value} gap="middle" align="center">
                <Tooltip title={usage.help}>
                  <span className={styles.nameType}>{usage.label}</span>
                </Tooltip>
                <Form.Item name={["keyUsageStates", usage.value]} noStyle>
                  <Select
                    className={styles.select}
                    aria-label={usage.label}
                    options={usageOptions}
                  />
                </Form.Item>
              </Flex>
            ))}
          </Flex>
        </Form.Item>
        <Rows
          setting="extendedKeyUsages"
          add={{ label: "Add a usage", value: { state: "forced" } }}
          row={(field) => (
            <>
              <Form.Item
                name={[field.name, "oid"]}
                rules={[
                  { required: true, message: "The usage" },
                  { pattern: OID, message: "A dotted OID" },
                ]}
                noStyle
              >
                <AutoComplete
                  className={styles.wide}
                  placeholder="OID"
                  options={KNOWN_EKUS}
                />
              </Form.Item>
              <Form.Item name={[field.name, "state"]} noStyle>
                <Select
                  className={styles.select}
                  aria-label="State"
                  options={usageOptions.filter((o) => o.value !== "excluded")}
                />
              </Form.Item>
            </>
          )}
        />
      </>
    ),
    signature: (
      <Flex gap="middle" wrap>
        {(
          [
            "signatureHash",
            "rsaPadding",
            "subjectKeyIdentifier",
            "authorityKeyIdentifier",
            "basicConstraints",
          ] as const
        ).map((key) => (
          <Setting key={key} setting={key}>
            <Select className={styles.choice} options={choicesOf(key)} />
          </Setting>
        ))}
      </Flex>
    ),
    extensions: (
      <>
        <Setting setting="extensions">
          <Radio.Group optionType="button" options={choicesOf("extensions")} />
        </Setting>
        <Flex gap="large" wrap>
          <Setting setting="includeCrlDistribution" switch>
            <Switch />
          </Setting>
          <Setting setting="includeCaIssuers" switch>
            <Switch />
          </Setting>
          <Setting setting="includeIssuerAltName" switch>
            <Switch />
          </Setting>
          <Setting setting="includeOcsp" switch>
            <Switch />
          </Setting>
          <Setting setting="mustStaple" switch>
            <Switch />
          </Setting>
        </Flex>
        {noResponder && (
          <Alert
            type="warning"
            showIcon
            title="Its CA has no OCSP responder in service"
            description="Certificates that carry the OCSP URL are refused until it has one: an online CA's is issued by the service on its next run, an offline CA's in one of its ceremonies."
          />
        )}
        <Rows
          setting="policies"
          add={{ label: "Add a policy", value: {} }}
          row={(field) => (
            <>
              <Form.Item
                name={[field.name, "oid"]}
                rules={[
                  { required: true, message: "The policy" },
                  { pattern: OID, message: "A dotted OID" },
                ]}
                noStyle
              >
                <Input className={styles.text} placeholder="Policy OID" />
              </Form.Item>
              <Form.Item name={[field.name, "cpsUri"]} noStyle>
                <Input className={styles.wide} placeholder="CPS URI" />
              </Form.Item>
              <Form.Item name={[field.name, "userNotice"]} noStyle>
                <Input
                  className={styles.wide}
                  maxLength={200}
                  placeholder="User notice"
                />
              </Form.Item>
            </>
          )}
        />
        <Rows
          setting="customExtensions"
          add={{ label: "Add an extension", value: { critical: false } }}
          row={(field) => (
            <>
              <Form.Item
                name={[field.name, "oid"]}
                rules={[
                  { required: true, message: "The extension" },
                  { pattern: OID, message: "A dotted OID" },
                ]}
                noStyle
              >
                <Input className={styles.text} placeholder="Extension OID" />
              </Form.Item>
              <Form.Item
                name={[field.name, "critical"]}
                valuePropName="checked"
                noStyle
              >
                <Checkbox>Critical</Checkbox>
              </Form.Item>
              <Form.Item
                name={[field.name, "value"]}
                rules={[{ required: true, message: "Its DER value, base64" }]}
                noStyle
              >
                <Input.TextArea
                  className={styles.wide}
                  autoSize
                  placeholder="DER value, base64"
                />
              </Form.Item>
            </>
          )}
        />
      </>
    ),
  };

  const sshSections = (
    <>
      <Card size="small" title="SSH certificates" className={styles.section}>
        <Flex gap="middle" wrap>
          <Form.Item
            name={["ssh", "certificateType"]}
            label={<SshSettingLabel setting="certificateType" />}
          >
            <Select
              className={styles.choice}
              options={(["user", "host"] as const).map((t) => ({
                value: t,
                label: `${SSH_TYPES[t].label} certificates`,
              }))}
              onChange={(type: SshCertificateType) => {
                // A type's own defaults: a host's validity is months, and it
                // carries no options or extensions.
                form.setFieldsValue({ ssh: NEW_SSH_SETTINGS[type] });
                const all = { ...initial, ...form.getFieldsValue(true) };
                setValues(all);
                setDirty(true);
              }}
            />
          </Form.Item>
          <Form.Item
            name={["ssh", "sshCaId"]}
            label={<SshSettingLabel setting="sshCaId" />}
          >
            <Select
              allowClear
              className={styles.choice}
              placeholder="The newest active CA of its type"
              options={(sshCas ?? [])
                .filter((ca) => ca.status === "active" && ca.type === sshType)
                .map((ca) => ({ value: ca.id, label: ca.name }))}
            />
          </Form.Item>
        </Flex>
        <Flex gap="middle" wrap>
          <Form.Item
            name={["ssh", "validityHours"]}
            label={<SshSettingLabel setting="validityHours" />}
          >
            <InputNumber {...hours} max={400 * 24} />
          </Form.Item>
          <Form.Item
            name={["ssh", "renewAtHours"]}
            label={<SshSettingLabel setting="renewAtHours" />}
          >
            <InputNumber {...hours} max={400 * 24} />
          </Form.Item>
          <Setting setting="maxKeyAgeDays">
            <InputNumber {...days} />
          </Setting>
        </Flex>
        <Setting setting="keyAlgorithms">
          <Select
            mode="multiple"
            allowClear
            className={styles.wide}
            placeholder="Any OpenSSH certifies"
            options={SSH_KEY_ALGORITHMS.map((k) => ({ value: k }))}
          />
        </Setting>
      </Card>
      {sshType === "user" && (
        <Card
          size="small"
          title="What a user certificate allows"
          className={styles.section}
        >
          <Form.Item
            name={["ssh", "extensions"]}
            label={<SshSettingLabel setting="extensions" />}
          >
            <Checkbox.Group>
              <Flex vertical gap="small">
                {SSH_EXTENSIONS.map((e) => (
                  <Checkbox key={e.value} value={e.value}>
                    <Tooltip title={e.help}>
                      <span>{e.label}</span>
                    </Tooltip>
                  </Checkbox>
                ))}
              </Flex>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item
            name={["ssh", "sourceAddresses"]}
            label={<SshSettingLabel setting="sourceAddresses" />}
          >
            <Select
              mode="tags"
              open={false}
              tokenSeparators={[",", " "]}
              className={styles.wide}
              placeholder="Anywhere"
            />
          </Form.Item>
          <Form.Item
            name={["ssh", "forceCommand"]}
            label={<SshSettingLabel setting="forceCommand" />}
          >
            <Input className={styles.wide} placeholder="Any command" />
          </Form.Item>
        </Card>
      )}
    </>
  );

  return (
    <SideTabPanel
      panelId="harpocrates.profile-editor"
      width={PANEL_WIDTH}
      defaultExpanded
      className={styles.page}
      tabs={[
        {
          key: "preview",
          label: (
            <Tooltip title="Preview" placement="left">
              <span aria-label="Preview">
                <EyeOutlined />
              </span>
            </Tooltip>
          ),
          children: (
            <ProfilePreviewPanel
              settings={settings}
              kind={kind}
              directOnly={profile?.directOnly}
            />
          ),
        },
      ]}
    >
      <Flex vertical gap="large">
        <Typography.Title level={3}>
          {editing
            ? `Edit ${editing}`
            : kind === "ssh"
              ? "New SSH profile"
              : "New profile"}
        </Typography.Title>
        <RecentSignInNotice
          doing={editing ? "Changing a profile" : "Making a profile"}
        />
        {editing && (
          <Typography.Text type="secondary">
            A change of settings makes v{profile!.version + 1}; certificates
            issued under earlier versions renew under theirs until moved.
          </Typography.Text>
        )}
        <Form<ProfileForm>
          form={form}
          layout="vertical"
          initialValues={initial}
          onValuesChange={(_, all) => {
            setValues({ ...initial, ...all });
            setDirty(true);
          }}
        >
          <Card size="small" title="Profile">
            <Flex gap="middle" wrap>
              {!editing && (
                <Form.Item
                  name="id"
                  label="Name"
                  tooltip="Its name: lower case, digits and hyphens, e.g. web-tls. It cannot change."
                  rules={[
                    { required: true, message: "Required" },
                    {
                      pattern: PROFILE_SLUG,
                      message: "Lower case, digits and hyphens",
                    },
                  ]}
                >
                  <Input
                    className={styles.text}
                    placeholder={kind === "ssh" ? "ssh-admin" : "web-tls"}
                  />
                </Form.Item>
              )}
              <Form.Item
                name="description"
                label="Description"
                tooltip="What it is for. Changing it alone makes no new version."
                rules={[{ required: true, message: "Required" }]}
                className={styles.grow}
              >
                <Input maxLength={200} />
              </Form.Item>
            </Flex>
          </Card>
          {kind === "ssh"
            ? sshSections
            : SECTIONS.map((section) => (
                <Card
                  key={section.key}
                  size="small"
                  title={section.title}
                  className={styles.section}
                >
                  {sections[section.key]}
                </Card>
              ))}
        </Form>
        <ErrorAlert error={error} />
        <Flex gap="small">
          <Button type="primary" loading={saving} onClick={save}>
            {editing ? "Save" : "Make the profile"}
          </Button>
          <Link href={editing ? `/profiles?id=${editing}` : "/profiles"}>
            <Button>Cancel</Button>
          </Link>
        </Flex>
      </Flex>
    </SideTabPanel>
  );
}

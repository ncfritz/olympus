import type {
  SshCertificateContents,
  SshCertificateType,
  SshExtension,
  SshProfileSettings,
} from "./api/types";

/**
 * SSH certificates as the console explains them (ADR 0035): their two
 * types, OpenSSH's extensions, the SSH settings of a profile, and the
 * files a certificate is installed as.
 */

export const SSH_TYPES: Record<
  SshCertificateType,
  { label: string; help: string }
> = {
  user: {
    label: "User",
    help: "Logs its holder in as its principals, on every host that trusts the user CA.",
  },
  host: {
    label: "Host",
    help: "Vouches for a host's names, so clients that trust the host CA connect without a host-key prompt.",
  },
};

/** OpenSSH's extensions: each, when present, permits what it names. */
export const SSH_EXTENSIONS: {
  value: SshExtension;
  label: string;
  help: string;
}[] = [
  {
    value: "permit-pty",
    label: "permit-pty",
    help: "A terminal: an interactive login. Without it, commands only.",
  },
  {
    value: "permit-port-forwarding",
    label: "permit-port-forwarding",
    help: "Forwarding ports (ssh -L, -R, -D).",
  },
  {
    value: "permit-agent-forwarding",
    label: "permit-agent-forwarding",
    help: "Forwarding the SSH agent to the host (ssh -A).",
  },
  {
    value: "permit-X11-forwarding",
    label: "permit-X11-forwarding",
    help: "Forwarding X11 (ssh -X).",
  },
  {
    value: "permit-user-rc",
    label: "permit-user-rc",
    help: "Running ~/.ssh/rc at login.",
  },
];

/** An SSH version's own settings, each with a label and help. */
export const SSH_SETTINGS: Record<
  keyof SshProfileSettings,
  { label: string; help: string }
> = {
  certificateType: {
    label: "Certificate type",
    help: "User certificates log people in; host certificates vouch for hosts. Its CA must sign the same type.",
  },
  sshCaId: {
    label: "SSH CA",
    help: "The CA it is pinned to. Unset, the newest active CA of its type signs, so a rotation needs no new version.",
  },
  validityHours: {
    label: "Validity",
    help: "How long its certificates are valid, in hours, within the CA's maximum. A user certificate is best a working day; a host certificate, months.",
  },
  renewAtHours: {
    label: "Renew at",
    help: "How many hours into a certificate's life it is due for renewal: less than its validity. A host renews itself from then (harpocrates-ssh-host renew).",
  },
  forceCommand: {
    label: "Force command",
    help: "The force-command critical option: the one command a user certificate may run, whatever is asked. Empty, any.",
  },
  sourceAddresses: {
    label: "Source addresses",
    help: "The source-address critical option: addresses or networks (192.168.15.0/24) a user certificate is used from. None, anywhere.",
  },
  extensions: {
    label: "Extensions",
    help: "What a user certificate permits. A host certificate carries none.",
  },
};

/** "16 hours", "90 days": a validity in hours as one thinks of it. */
export const describeHours = (hours: number): string =>
  hours % 24 === 0 && hours >= 48
    ? `${hours / 24} days`
    : `${hours} hour${hours === 1 ? "" : "s"}`;

/** A key type as OpenSSH names its files: ed25519, ecdsa, rsa. */
const fileKeyType = (keyType: string): string =>
  keyType === "ssh-ed25519"
    ? "ed25519"
    : keyType.startsWith("ecdsa-")
      ? "ecdsa"
      : keyType === "ssh-rsa"
        ? "rsa"
        : keyType;

/**
 * The file a certificate is installed as, beside its key: OpenSSH finds a
 * user's `id_ed25519-cert.pub` by itself; a host's is the one
 * `HostCertificate` names.
 */
export const certificateFileName = (
  contents: Pick<SshCertificateContents, "type" | "keyType">,
): string =>
  contents.type === "user"
    ? `id_${fileKeyType(contents.keyType)}-cert.pub`
    : `ssh_host_${fileKeyType(contents.keyType)}_key-cert.pub`;

/** A new SSH profile's settings: a user certificate for a working day. */
export const NEW_SSH_SETTINGS: Record<SshCertificateType, SshProfileSettings> =
  {
    user: {
      certificateType: "user",
      sshCaId: null,
      validityHours: 16,
      renewAtHours: 12,
      sourceAddresses: [],
      extensions: ["permit-pty", "permit-port-forwarding"],
    },
    host: {
      certificateType: "host",
      sshCaId: null,
      validityHours: 2160,
      renewAtHours: 1440,
      sourceAddresses: [],
      extensions: [],
    },
  };

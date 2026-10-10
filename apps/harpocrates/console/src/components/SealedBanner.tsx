"use client";

import { Alert, Button } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser, useSignerStatus } from "@/lib/api/queries";

const REASONS: Record<string, string> = {
  uninitialised: "The signer has not been initialised.",
  deliberate: "The signer was sealed deliberately.",
  "no-unseal-key": "The signer started without its unseal key.",
  "wrong-unseal-key": "The signer's unseal key did not open its store.",
};

/**
 * On every page while the signer is sealed: certificates, lists and
 * ceremonies all wait for it (ADR 0020, Key protection).
 */
export function SealedBanner() {
  const { data: user } = useCurrentUser();
  const { data: status } = useSignerStatus();
  const pathname = usePathname();
  if (!user || !status?.sealed || pathname === "/setup") return null;
  const uninitialised = !status.initialised;
  return (
    <Alert
      type={uninitialised ? "info" : "warning"}
      showIcon
      banner
      title={uninitialised ? "Set up the signer" : "The signer is sealed"}
      description={
        uninitialised
          ? "Harpocrates cannot create a CA or sign anything until its signer has a recovery passphrase and an unseal key."
          : `${REASONS[status.reason ?? ""] ?? ""} Nothing is signed until it is unsealed.`
      }
      action={
        <Link href={uninitialised ? "/setup" : "/"}>
          <Button size="small">{uninitialised ? "Set up" : "Unseal"}</Button>
        </Link>
      }
    />
  );
}

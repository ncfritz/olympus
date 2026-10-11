"use client";

import { Alert, Button, Flex, Popconfirm } from "antd";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { expectOk } from "@/lib/api/errors";
import {
  KEYS,
  useCeremony,
  useCurrentUser,
  useIssuers,
  useSignerStatus,
} from "@/lib/api/queries";
import { commonName } from "@/lib/tree";
import { ErrorAlert } from "./ErrorAlert";

/**
 * The ceremony the signer holds now, if any: the signer holds one at a
 * time, so another cannot open until it closes. Says whose it is, and
 * offers to go to it or close it.
 */
export function OpenCeremonyAlert() {
  const { data: status } = useSignerStatus();
  const ceremonyId = status?.ceremonyId;
  const { isAdmin } = useCurrentUser();
  // Describing a ceremony is an admin's: others are told only that one is open.
  const { data: ceremony } = useCeremony(isAdmin ? ceremonyId : undefined);
  const { data: issuers } = useIssuers();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  if (!ceremonyId) return null;

  const holder = (issuers ?? []).find((i) => i.id === ceremony?.issuerId);
  const close = async () => {
    setBusy(true);
    try {
      expectOk(
        await apiClient.DELETE("/v1/ceremony/{ceremonyId}", {
          params: { path: { ceremonyId } },
        }),
      );
      setError(undefined);
      await Promise.all([
        mutate(KEYS.signer),
        mutate(KEYS.ceremony(ceremonyId)),
        ...(ceremony ? [mutate(KEYS.issuerCeremonies(ceremony.issuerId))] : []),
      ]);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex vertical gap="small">
      <Alert
        type="warning"
        showIcon
        title={
          holder
            ? `A ceremony is open for ${commonName(holder.subject)}`
            : "A ceremony is open"
        }
        description="The signer holds one ceremony at a time: close it before opening another."
        action={
          <Flex gap="small">
            <Link href={`/ceremony?id=${ceremonyId}`}>
              <Button size="small">Go to it</Button>
            </Link>
            {isAdmin && (
              <Popconfirm
                title="Close the open ceremony?"
                description="The signer forgets the key; opening another needs the key file again."
                okText="Close it"
                onConfirm={close}
              >
                <Button size="small" danger loading={busy}>
                  Close it
                </Button>
              </Popconfirm>
            )}
          </Flex>
        }
      />
      <ErrorAlert error={error} />
    </Flex>
  );
}

import { Button, Descriptions, Flex, Popconfirm, Typography } from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useIssuerOcsp } from "@/lib/api/queries";
import type { OcspResponder } from "@/lib/api/types";
import { formatDate } from "@/lib/labels";
import { currentResponder } from "@/lib/ocsp";
import { ErrorAlert } from "./ErrorAlert";

/**
 * An offline CA's OCSP responder, issued in its ceremony (ADR 0036): a
 * key in the signer with a certificate this CA signs, valid as long as
 * its list, which signs the CA's responses while its own key is offline.
 */
export function CeremonyOcspPanel({
  ceremonyId,
  issuerId,
}: {
  ceremonyId: string;
  issuerId: string;
}) {
  const { data } = useIssuerOcsp(issuerId);
  const { mutate } = useSWRConfig();
  const [issued, setIssued] = useState<OcspResponder>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const current = currentResponder(data?.responders);

  const issue = async () => {
    setBusy(true);
    try {
      const { responder } = unwrap(
        await apiClient.POST("/v1/ceremony/{ceremonyId}/ocsp-responder", {
          params: { path: { ceremonyId } },
        }),
      );
      setIssued(responder);
      setError(undefined);
      await mutate(KEYS.issuerOcsp(issuerId));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const button = (
    <Button loading={busy} onClick={current ? undefined : issue}>
      Issue a responder
    </Button>
  );

  return (
    <Flex vertical gap="middle" align="start">
      <Typography.Text type="secondary">
        An offline CA&apos;s OCSP responses are signed by a responder it issues
        here, valid as long as its list. Issue one before the last lapses; its
        responses are signed at once.
      </Typography.Text>
      {current && (
        <Typography.Text>
          The responder in service ({current.serial}) lasts until{" "}
          {formatDate(current.notAfter)}.
        </Typography.Text>
      )}
      <ErrorAlert error={error} />
      {current ? (
        <Popconfirm
          title="Issue a new responder?"
          description="It takes over from the one in service, which is superseded."
          okText="Issue"
          onConfirm={issue}
        >
          {button}
        </Popconfirm>
      ) : (
        button
      )}
      {issued && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Serial">
            <Typography.Text code>{issued.serial}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Subject">
            {issued.subject}
          </Descriptions.Item>
          <Descriptions.Item label="Valid until">
            {formatDate(issued.notAfter)}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Flex>
  );
}

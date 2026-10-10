"use client";

import { Alert, Button, Flex, Form, Result, Typography } from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useProfiles } from "@/lib/api/queries";
import type {
  PreviewIssuerRequest,
  PreviewIssuerResponse,
} from "@/lib/api/types";
import { createBodyOf } from "@/lib/caRequest";
import { commonName } from "@/lib/tree";
import { useLeaveWarning } from "@/lib/useLeaveWarning";
import { CaSettings } from "./CaSettings";
import { ErrorAlert } from "./ErrorAlert";
import { KeyHandover } from "./KeyHandover";
import { PassphraseFields } from "./PassphraseFields";

type Made = { id: string; subject: string; key?: string };

/**
 * A CA signed in a ceremony: an offline intermediate, whose key is handed
 * over once, or an online issuing CA, whose key stays in the signer. Its
 * name and settings are reviewed first, as a root's are (ADR 0032).
 */
export function CeremonyCaPanel({
  ceremonyId,
  parentId,
  tier,
}: {
  ceremonyId: string;
  parentId: string;
  tier: "intermediate" | "issuing";
}) {
  const { mutate } = useSWRConfig();
  const { data: profiles } = useProfiles();
  const purposes = useMemo(
    () =>
      [
        ...new Set(
          (profiles ?? [])
            .filter((profile) => !profile.directOnly)
            .map((profile) => profile.issuerPurpose),
        ),
      ].sort(),
    [profiles],
  );
  const target = useMemo(() => ({ tier, parentId }), [tier, parentId]);
  const [reviewed, setReviewed] = useState<{
    request: PreviewIssuerRequest;
    answer?: PreviewIssuerResponse;
  }>();
  const [made, setMade] = useState<Made>();
  // A new form for each CA, once the last one is done.
  const [round, setRound] = useState(0);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  useLeaveWarning(Boolean(made?.key));

  const ready =
    reviewed?.answer !== undefined && reviewed.answer.problems.length === 0;

  const create = async ({ passphrase }: { passphrase?: string }) => {
    if (!reviewed?.answer) return;
    setBusy(true);
    try {
      const body = createBodyOf(reviewed.request);
      const parts = {
        number: reviewed.request.number,
        generation: reviewed.request.generation,
      };
      if (tier === "intermediate") {
        const answer = unwrap(
          await apiClient.POST("/v1/ceremony/{ceremonyId}/intermediates", {
            params: { path: { ceremonyId } },
            body: { ...body, ...parts, exportPassphrase: passphrase! },
          }),
        );
        setMade({
          id: answer.issuer.id,
          subject: answer.issuer.subject,
          key: answer.encryptedKey,
        });
      } else {
        const { preview } = reviewed.answer;
        const answer = unwrap(
          await apiClient.POST("/v1/ceremony/{ceremonyId}/issuing", {
            params: { path: { ceremonyId } },
            body: {
              ...body,
              ...parts,
              purpose: reviewed.request.purpose!,
              maxValidityDays: preview.maxValidityDays,
              extendedKeyUsages: preview.extendedKeyUsages,
            },
          }),
        );
        setMade({ id: answer.issuer.id, subject: answer.issuer.subject });
      }
      setError(undefined);
      await mutate(KEYS.issuers);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const another = () => {
    setMade(undefined);
    setReviewed(undefined);
    setRound((n) => n + 1);
  };

  if (made?.key) {
    return (
      <KeyHandover
        issuerId={made.id}
        encryptedKey={made.key}
        doneLabel="Done with this one"
        onDone={() => setMade({ id: made.id, subject: made.subject })}
      />
    );
  }
  if (made) {
    return (
      <Result
        status="success"
        title={`${commonName(made.subject)} is signed`}
        subTitle={
          tier === "issuing"
            ? "Its key is in the signer; it issues once its certificate and its parent's list are published."
            : "Its key is on the offline media. Its first ceremony proves the backup."
        }
        extra={[
          <Link key="ca" href={`/ca?id=${made.id}`}>
            <Button>View it</Button>
          </Link>,
          <Button key="another" type="primary" onClick={another}>
            Sign another
          </Button>,
        ]}
      />
    );
  }

  return (
    <Flex vertical gap="large">
      <CaSettings
        key={round}
        target={target}
        purposes={tier === "issuing" ? purposes : undefined}
        onReviewed={(request, answer) => setReviewed({ request, answer })}
      />
      {tier === "intermediate" && (
        <Alert
          type="info"
          showIcon
          title="Its key leaves once, encrypted under the passphrase below"
        />
      )}
      <Form<{ passphrase?: string }> layout="vertical" onFinish={create}>
        {tier === "intermediate" && (
          <PassphraseFields
            label="Export passphrase"
            extra="Opens its key file at its own ceremonies"
          />
        )}
        <Button
          type="primary"
          htmlType="submit"
          disabled={!ready}
          loading={busy}
        >
          {tier === "intermediate"
            ? "Sign the intermediate"
            : "Sign the issuing CA"}
        </Button>
      </Form>
      {!ready && reviewed?.answer && (
        <Typography.Text type="secondary">
          Resolve what the review refuses first.
        </Typography.Text>
      )}
      <ErrorAlert error={error} />
    </Flex>
  );
}

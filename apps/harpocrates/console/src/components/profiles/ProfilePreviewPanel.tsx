import { Alert, Descriptions, Divider, Flex, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { ProfilePreview, ProfileSettings } from "@/lib/api/types";
import { CertificateDetails } from "../CertificateDetails";
import { ErrorAlert } from "../ErrorAlert";

/** How long the settings must rest before they are previewed again. */
const SETTLE_MS = 600;

/** The settings, once they have stopped changing for a moment. */
const useSettled = <T,>(value: T): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
};

const namesText = (names: ProfilePreview["sampleNames"]): string =>
  Object.values(names).flat().filter(Boolean).join(", ") || "None";

/**
 * The certificate a version would produce (ADR 0034, preview), as the
 * settings stand: built by the signer with a throwaway key from a sample
 * request, with why the version would not save and why the sample would
 * be refused. It follows the editor as it changes.
 */
export function ProfilePreviewPanel({
  settings,
  directOnly = false,
}: {
  settings: ProfileSettings;
  directOnly?: boolean;
}) {
  const body = useSettled(JSON.stringify({ profile: settings, directOnly }));
  const { data, error, isLoading } = useSWR<ProfilePreview>(
    ["profile-preview", body],
    async () =>
      unwrap(
        await apiClient.POST("/v1/profiles/preview", {
          body: JSON.parse(body),
        }),
      ).preview,
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center">
        <Typography.Title level={5}>Preview</Typography.Title>
        {isLoading && <Spin size="small" />}
      </Flex>
      <Typography.Text type="secondary">
        A sample certificate, built by the signer as issuance would build it,
        signed by a throwaway key: it never verifies.
      </Typography.Text>
      <ErrorAlert error={error} />
      {data && (
        <>
          {data.problems.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title="It would not save"
              description={
                <ul>
                  {data.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              }
            />
          )}
          {data.refusals.length > 0 && (
            <Alert
              type="error"
              showIcon
              title="The sample request would be refused"
              description={
                <ul>
                  {data.refusals.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              }
            />
          )}
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: "issuer",
                label: "Issued by",
                children: data.issuerId ?? "No CA",
              },
              {
                key: "subject",
                label: "Sample subject",
                children:
                  [
                    data.sampleSubject.commonName &&
                      `CN=${data.sampleSubject.commonName}`,
                    ...(data.sampleSubject.attributes ?? []).map(
                      (a) => `${a.type}=${a.value}`,
                    ),
                  ]
                    .filter(Boolean)
                    .join(", ") || "None",
              },
              {
                key: "names",
                label: "Sample names",
                children: namesText(data.sampleNames),
              },
              { key: "key", label: "Sample key", children: data.keyAlgorithm },
            ]}
          />
          {data.certificate && (
            <>
              <Divider titlePlacement="start">Certificate</Divider>
              <CertificateDetails pem={data.certificate} nameConstraints={[]} />
            </>
          )}
        </>
      )}
    </Flex>
  );
}

import type { CalendarAccountClaim } from "@ncfritz/olympus-sdk/minerva";
import { CheckCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Flex, Result, Skeleton, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import calendarsApi from "../../../api/calendarsApi";
import { useAuth } from "../../../auth/AuthProvider";
import CalendarsBreadcrumbs from "../../../components/minerva/calendars/CalendarsBreadcrumbs";
import {
  CALENDARS_PATH,
  claimProblem,
  type ClaimProblem,
  errorStatus,
  PROVIDER_BADGES,
  PROVIDER_NAMES,
} from "../../../utils/calendars";

const { Title, Paragraph, Text } = Typography;

type View =
  | { state: "loading" }
  | { state: "open"; claim: CalendarAccountClaim }
  | { state: "confirmed"; email: string }
  | { state: "refused"; problem: ClaimProblem };

/**
 * Where a claim's emailed link lands (ADR 0028, way 3):
 * `/minerva/calendars/claim?token=…`. Showing the claim changes nothing,
 * since a mail scanner may open the link; only Confirm links the account.
 */
const ClaimPage: React.FunctionComponent = () => {
  const router = useRouter();
  const auth = useAuth();
  const [view, setView] = useState<View>({ state: "loading" });
  const [confirming, setConfirming] = useState(false);
  const token =
    typeof router.query.token === "string" ? router.query.token : "";

  useEffect(() => {
    if (!router.isReady) return;
    if (!token) {
      setView({ state: "refused", problem: claimProblem(404) });
      return;
    }
    calendarsApi
      .describeClaim(token)
      .then((claim) => setView({ state: "open", claim }))
      .catch((error) =>
        setView({
          state: "refused",
          problem: claimProblem(errorStatus(error)),
        }),
      );
  }, [router.isReady, token]);

  const confirm = async () => {
    if (view.state !== "open") return;
    setConfirming(true);
    try {
      const account = await calendarsApi.confirmClaim(token);
      setView({ state: "confirmed", email: account.email });
    } catch (error) {
      setView({ state: "refused", problem: claimProblem(errorStatus(error)) });
    } finally {
      setConfirming(false);
    }
  };

  const me = auth.status === "signed-in" ? auth.user : undefined;

  return (
    <>
      <CalendarsBreadcrumbs trail={["Claim"]} />
      <div
        style={{
          height: "calc(100vh - 92px)",
          overflowY: "auto",
          padding: "32px 24px",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {view.state === "loading" && (
            <Card>
              <Skeleton active={true} />
            </Card>
          )}
          {view.state === "open" && (
            <Card>
              <Title level={4} style={{ marginTop: 0 }}>
                Link this calendar account to you?
              </Title>
              <Paragraph type={"secondary"}>
                You asked to claim it, and opened the link we sent to its inbox.
                Confirm, and its calendars sync into your Minerva, including its
                meetings from before today.
              </Paragraph>
              <Flex
                gap={14}
                align={"center"}
                style={{
                  padding: 16,
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  background: "#fafafa",
                  marginBottom: 20,
                }}
              >
                <span
                  aria-hidden={true}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background:
                      PROVIDER_BADGES[view.claim.provider]?.color ?? "#8c8c8c",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {PROVIDER_BADGES[view.claim.provider]?.letter ?? "?"}
                </span>
                <Flex vertical={true}>
                  <Text strong={true} style={{ fontSize: 16 }}>
                    {view.claim.email}
                  </Text>
                  <Text type={"secondary"} style={{ fontSize: 12 }}>
                    {PROVIDER_NAMES[view.claim.provider] ?? view.claim.provider}{" "}
                    · link valid until{" "}
                    {DateTime.fromISO(view.claim.expiresTime).toFormat(
                      "MMM d, yyyy, h:mm a",
                    )}
                  </Text>
                </Flex>
              </Flex>
              <Flex justify={"flex-end"} gap={8}>
                <Link href={CALENDARS_PATH}>
                  <Button>Not now</Button>
                </Link>
                <Button type={"primary"} loading={confirming} onClick={confirm}>
                  Confirm, it&apos;s mine
                </Button>
              </Flex>
              {me && (
                <Paragraph
                  type={"secondary"}
                  style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}
                >
                  Signed in as {me.displayName}. Opening this page changed
                  nothing; only Confirm does.
                </Paragraph>
              )}
            </Card>
          )}
          {view.state === "confirmed" && (
            <Result
              icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              title={`${view.email} is yours`}
              subTitle={
                "Its meetings are on their way into Minerva. Pick which of its calendars sync on the Calendars page."
              }
              extra={
                <Link href={CALENDARS_PATH}>
                  <Button type={"primary"}>Go to Calendars</Button>
                </Link>
              }
            />
          )}
          {view.state === "refused" && (
            <Card>
              <Alert
                type={"warning"}
                showIcon={true}
                title={view.problem.title}
                description={view.problem.description}
              />
              <Flex justify={"flex-end"} style={{ marginTop: 16 }}>
                <Link href={CALENDARS_PATH}>
                  <Button
                    type={view.problem.claimAgain ? "primary" : "default"}
                  >
                    {view.problem.claimAgain
                      ? "Claim again"
                      : "Go to Calendars"}
                  </Button>
                </Link>
              </Flex>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default ClaimPage;

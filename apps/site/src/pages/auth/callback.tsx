import { Alert, Button, Card, Space, Spin } from "antd";
import { Content } from "antd/lib/layout/layout";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { completeOnce, pageSession } from "../../auth/pageSession";

/**
 * Where the API sends the browser back with an authorization code.
 *
 * A page rather than a Next route handler: `/api/` belongs to the API, this site
 * has no server side, and the exchange has to happen where the verifier is --
 * which is `sessionStorage` in this tab.
 */
const CallbackPage: React.FunctionComponent = () => {
  const router = useRouter();
  const [problem, setProblem] = useState<string | undefined>(undefined);

  useEffect(() => {
    // `router.isReady` is what says the query has been parsed on a static
    // export; the search string is read directly, so only the replace below
    // needs the router.
    let current = true;
    void (async () => {
      try {
        // `completeOnce`, not the completion itself: this effect runs again
        // when the router object changes, and the code and verifier are spent.
        const done = await completeOnce();
        if (!current) return;
        if ("problem" in done) {
          setProblem(done.problem);
          return;
        }
        pageSession.hold(done.tokens);
        // `replace`, not `push`: the code is spent, and Back onto this URL would
        // present it a second time for nothing.
        await router.replace(done.returnTo);
      } catch (error: unknown) {
        if (!current) return;
        setProblem(
          error instanceof Error
            ? error.message
            : "The authorization code could not be exchanged.",
        );
      }
    })();
    return () => {
      current = false;
    };
  }, [router]);

  return (
    <Content
      style={{
        margin: 16,
        marginTop: 64,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Card style={{ width: 450 }} hoverable={false}>
        {problem === undefined ? (
          <Space direction={"vertical"} style={{ width: "100%" }} size={16}>
            <Spin size={"large"} />
            Finishing sign-in…
          </Space>
        ) : (
          <Space direction={"vertical"} style={{ width: "100%" }} size={16}>
            <Alert type={"error"} message={problem} showIcon={true} />
            <Button
              type={"primary"}
              block={true}
              onClick={() => {
                void router.replace("/auth/signin");
              }}
            >
              Start again
            </Button>
          </Space>
        )}
      </Card>
    </Content>
  );
};

export default CallbackPage;

import { GoogleOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Space } from "antd";
import { Content } from "antd/lib/layout/layout";
import { type ReactNode, useState } from "react";
import { PROVIDERS } from "../../auth/providers";
import { API_BASE_URL } from "../../auth/interceptors";
import { startSignIn } from "../../auth/signIn";

const ICONS: Record<string, ReactNode> = {
  google: <GoogleOutlined />,
};

const SignInPage: React.FunctionComponent = () => {
  // Set while the browser is on its way out to the provider: the navigation is
  // not instant, and two clicks would be two sign-ins with two verifiers, of
  // which only the second could be completed.
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  return (
    <Content
      style={{
        margin: 16,
        marginTop: 64,
        background: "#fff",
        display: "flex",
        justifyContent: "center",
        flexDirection: "row",
      }}
    >
      <Card
        style={{ width: 450 }}
        hoverable={false}
        cover={<img src={"/auth_header.png"} alt={"Olympus"} />}
      >
        <Space
          direction={"vertical"}
          size={16}
          style={{ display: "flex", flexGrow: 1, alignItems: "center" }}
        >
          {problem !== undefined && (
            <Alert type={"error"} message={problem} showIcon={true} />
          )}
          {PROVIDERS.map((provider) => (
            <Button
              key={`provider-${provider.id}`}
              icon={ICONS[provider.id]}
              size={"large"}
              block={true}
              loading={leaving}
              onClick={() => {
                setProblem(undefined);
                setLeaving(true);
                startSignIn(API_BASE_URL, provider.id).catch(
                  (error: unknown) => {
                    setLeaving(false);
                    setProblem(
                      error instanceof Error
                        ? error.message
                        : "Sign-in could not be started.",
                    );
                  },
                );
              }}
            >
              Log in with {provider.label}
            </Button>
          ))}
        </Space>
      </Card>
    </Content>
  );
};

export default SignInPage;

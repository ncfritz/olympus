import { GithubOutlined } from "@ant-design/icons";
import { Button, Card, Space, Spin } from "antd";
import { Content } from "antd/lib/layout/layout";
import { type BuiltInProviderType } from "next-auth/providers";
import {
  type ClientSafeProvider,
  getProviders,
  type LiteralUnion,
  signIn,
} from "next-auth/react";
import { type ReactNode, useEffect, useState } from "react";

interface ProviderMeta {
  name: string;
  icon: ReactNode;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  github: {
    name: "GitHub",
    icon: <GithubOutlined />,
  },
};

const SignInPage: React.FunctionComponent = () => {
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState<
    | Record<LiteralUnion<BuiltInProviderType, string>, ClientSafeProvider>
    | undefined
  >();

  useEffect(() => {
    (async () => {
      try {
        setLoadingProviders(true);
        const res = await getProviders();
        setProviders(res === null ? undefined : res);
      } finally {
        setTimeout(() => {
          setLoadingProviders(false);
        }, 1500);
      }
    })();
  }, []);
  let providersList: ReactNode | ReactNode[] = (
    <Spin size={"large"} tip={"Loading providers..."}>
      <div></div>
    </Spin>
  );

  if (!loadingProviders) {
    providersList = Object.values(providers!).map((provider) => {
      const providerMeta = PROVIDER_META[provider.name];

      if (!providerMeta) {
        return undefined;
      }

      return (
        <Button
          key={`oauth-btn-${provider.name}`}
          icon={providerMeta.icon}
          size={"large"}
          block={true}
          onClick={async () => {
            await signIn(provider.id);
          }}
        >
          Log in with {providerMeta.name}
        </Button>
      );
    });
  }

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
        hoverable={true}
        cover={<img src={"/auth_header.png"} />}
      >
        <Space
          direction={"vertical"}
          size={16}
          style={{ display: "flex", flexGrow: 1, alignItems: "center" }}
        >
          {providersList}
        </Space>
      </Card>
    </Content>
  );
};

export default SignInPage;

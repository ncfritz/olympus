"use client";

import { Button, Card, Flex, Space, Typography } from "antd";
import type { SignInProvider } from "./types";

const { Title, Text } = Typography;

export interface SignInCardProps {
  title: string;
  providers: SignInProvider[];
  signInHref: (provider: string) => string;
}

/**
 * Until authentication phase 3 each console signs in against its own
 * agent, so this names the console rather than the suite: which session
 * you are being asked for is the useful thing to say.
 */
export const SignInCard = ({
  title,
  providers,
  signInHref,
}: SignInCardProps) => (
  <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
    <Card style={{ width: 360, textAlign: "center" }}>
      <Title level={3}>{title}</Title>
      <Text type="secondary">Sign in to use this console.</Text>
      <Space direction="vertical" size="middle" style={{ marginTop: 24 }}>
        {providers.map((provider) => (
          <a key={provider.name} href={signInHref(provider.name)}>
            <Button type="primary" icon={provider.icon} size="large">
              {provider.label}
            </Button>
          </a>
        ))}
      </Space>
    </Card>
  </Flex>
);

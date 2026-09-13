"use client";

import { GoogleOutlined, LogoutOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Layout, Space, Spin, Typography } from "antd";
import useSWR from "swr";
import { loginUrl } from "@/lib/api/client";
import { fetchCalendars } from "@/lib/api/queries";
import { useAuth } from "@/lib/auth/use-auth";
import { CalendarsPanel } from "./CalendarsPanel";
import { EventsPanel } from "./EventsPanel";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export function Dashboard() {
  const auth = useAuth();
  const {
    data: calendars = [],
    isLoading: calendarsLoading,
    mutate: refreshCalendars,
  } = useSWR(auth.status === "authenticated" ? "/calendars" : null, fetchCalendars);

  if (auth.status === "loading") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Card style={{ width: 360, textAlign: "center" }}>
          <Title level={3}>Minerva Calendar Sync</Title>
          <Text type="secondary">Sign in to view your synced calendars and events.</Text>
          <div style={{ marginTop: 24 }}>
            <a href={loginUrl("google")}>
              <Button type="primary" icon={<GoogleOutlined />} size="large">
                Sign in with Google
              </Button>
            </a>
          </div>
        </Card>
      </Flex>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Title level={4} style={{ color: "white", margin: 0 }}>
          Minerva Calendar Sync
        </Title>
        <Space>
          <Text style={{ color: "rgba(255,255,255,0.85)" }}>{auth.email}</Text>
          <Button icon={<LogoutOutlined />} onClick={auth.logout}>
            Log out
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: 24 }}>
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <CalendarsPanel calendars={calendars} loading={calendarsLoading} onRefresh={() => refreshCalendars()} />
          <EventsPanel calendars={calendars} />
        </Space>
      </Content>
    </Layout>
  );
}

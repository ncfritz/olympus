import { HomeOutlined, RadarChartOutlined } from "@ant-design/icons";
import { Breadcrumb, Col, Layout, Result, Row, Space, Spin } from "antd";
import Link from "next/link";
import React, { type ReactNode, useEffect, useState } from "react";
import themisApi from "../../api/themisApi";
import Badge from "../../components/themis/Badge";
import type { BasicUserInfo } from "../../types/themis";

const { Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const [users, setUsers] = useState<BasicUserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(false);

  const loadUsers = async (quiet: boolean = false) => {
    if (!quiet) {
      setUsersLoading(true);
    }

    setUsersError(false);

    try {
      const usersResponse = await themisApi.listUsers();
      setUsers(usersResponse.users);
    } catch (e) {
      setUsersError(true);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadUsers();
    })();
  }, []);

  let content: ReactNode;

  if (usersLoading) {
    content = (
      <Space style={{ marginTop: 64, width: "!00%", textAlign: "center" }}>
        <Spin size={"large"} />
      </Space>
    );
  } else if (usersError) {
    content = <Result status={"error"} title={"Unable to load users"} />;
  } else {
    content = (
      <Space
        direction={"vertical"}
        size={16}
        style={{ width: "100%", padding: 8 }}
      >
        <Space
          style={{
            width: "100%",
            maxWidth: 1500,
            display: "grid",
            gridGap: 12,
            gridTemplateColumns: "repeat(auto-fill, 90px)",
          }}
        >
          {users.map((user) => {
            return (
              <Badge
                size={"small"}
                username={user.username}
                name={`${user.givenName}`}
                tenure={5}
              />
            );
          })}
        </Space>
      </Space>
    );
  }

  return (
    <Space>
      <Breadcrumb
        style={{
          padding: 8,
          background: "#f6f6f6",
          position: "fixed",
          top: 64,
          width: "100%",
          zIndex: 1000,
        }}
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <RadarChartOutlined />
                <span>Themis</span>
              </Space>
            ),
          },
        ]}
      />
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          marginRight: 788,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 202px)",
        }}
      >
        <Content style={{ width: "calc(100vw -388px)" }}>{content}</Content>
      </Layout>
    </Space>
  );
};

export default IndexPage;
